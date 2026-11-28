import { env } from '$amplify/env/chat';
import {
  type LanguageModelV4,
  type LanguageModelV4FinishReason,
  type LanguageModelV4Prompt,
  type LanguageModelV4StreamPart,
  type LanguageModelV4ToolResultOutput,
  type LanguageModelV4ToolResultPart,
  type LanguageModelV4Usage,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import { createNullLanguageModelUsage } from '@ai-sdk/provider-utils';
import {
  BedrockAgentCoreClient,
  HarnessConversationRole,
  type HarnessContentBlock,
  type HarnessContentBlockDeltaEvent,
  type HarnessContentBlockStartEvent,
  type HarnessContentBlockStopEvent,
  type HarnessMessage,
  HarnessStopReason,
  type HarnessTokenUsage,
  type HarnessTool,
  type HarnessToolResultBlock,
  type HarnessToolResultContentBlock,
  HarnessToolType,
  HarnessToolUseStatus,
  InternalServerException,
  InvokeHarnessCommand,
  type InvokeHarnessStreamOutput,
  RuntimeClientError,
  ValidationException,
} from '@aws-sdk/client-bedrock-agentcore';
import { isSpecType } from '@modelcontextprotocol/client';
import { ReadableStream } from 'node:stream/web';

// Harness が止まった理由を、AI SDK の終了理由にします。Bedrock の Converse と同じ値は、
// AI SDK の Bedrock のプロバイダー（@ai-sdk/amazon-bedrock の mapAmazonBedrockFinishReason。公開されていない）と同じ読み替えにします。
// Harness: 出力の上限は length、ツールの呼び出しやモデルの出力の形の誤りは error にします。
function mapFinishReason(stopReason: HarnessStopReason | undefined): LanguageModelV4FinishReason['unified'] {
  switch (stopReason) {
    case HarnessStopReason.STOP_SEQUENCE:
    case HarnessStopReason.END_TURN:
      return 'stop';
    case HarnessStopReason.MAX_TOKENS:
    case HarnessStopReason.MAX_OUTPUT_TOKENS_EXCEEDED:
      return 'length';
    case HarnessStopReason.MALFORMED_TOOL_USE:
    case HarnessStopReason.MALFORMED_MODEL_OUTPUT:
      return 'error';
    case HarnessStopReason.CONTENT_FILTERED:
      return 'content-filter';
    case HarnessStopReason.TOOL_USE:
      return 'tool-calls';
    default:
      return 'other';
  }
}

// ツールの結果の部品を、1つの文にします。Harness のストリームの結果と、Memory の履歴の結果で使います。
export const contentText = (content: HarnessToolResultContentBlock[]) => content.map((item) => item.text ?? JSON.stringify(item.json)).join('');

// Gateway のツールです。Harness が、受け取ったトークンを交換して Gateway を呼びます。
const gatewayTool: HarnessTool = {
  type: HarnessToolType.AGENTCORE_GATEWAY,
  name: 'gw',
  config: {
    agentCoreGateway: {
      gatewayArn: env.GATEWAY_ARN,
      outboundAuth: {
        oauth: {
          providerArn: env.CREDENTIAL_PROVIDER_ARN,
          scopes: ['workops/chat'],
          grantType: 'TOKEN_EXCHANGE',
          customParameters: { subject_token_type: 'urn:ietf:params:oauth:token-type:access_token' },
        },
      },
    },
  },
};

// Managed Harness を、AI SDK のモデルとして使えるようにします。
// 読み取りのツールは Harness が Gateway で実行し、それ以外の AI SDK のツール（書込みのツール）は Harness に定義だけを渡して、呼び出しを AI SDK に返します。
// Harness は会話を自分で持つため、プロンプトのうち最後のAIの発話より後ろ（利用者の依頼か、ツールの結果）だけを送ります。
export function createHarnessModel(settings: {
  token: string;
  runtimeSessionId: string;
  actorId: string;
  readTools: string[];
}): LanguageModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'agentcore-harness',
    modelId: env.HARNESS_ARN,
    supportedUrls: {},
    doGenerate: () => {
      throw new UnsupportedFunctionalityError({ functionality: 'doGenerate' });
    },
    doStream: async ({ prompt, tools }) => {
      const read = new Set(settings.readTools);
      // 読み取りのツールを除いた関数のツールが書込みのツール（Harness には定義だけ渡す）
      const functionTools = (tools ?? []).flatMap((tool) => (tool.type === 'function' && !read.has(tool.name) ? [tool] : []));
      const messages = newMessages(prompt);
      const { stream } = await client(settings.token).send(
        new InvokeHarnessCommand({
          harnessArn: env.HARNESS_ARN,
          runtimeSessionId: settings.runtimeSessionId,
          actorId: settings.actorId,
          messages,
          tools: [
            gatewayTool,
            ...functionTools.map((tool): HarnessTool => {
              const { inputSchema } = tool;
              // Harness は JSON のスキーマしか受け取れない
              if (!isSpecType.JSONObject(inputSchema)) {
                throw new Error(`ツールの入力スキーマが JSON ではありません：${tool.name}`);
              }
              return { type: HarnessToolType.INLINE_FUNCTION, name: tool.name, config: { inlineFunction: { description: tool.description ?? tool.name, inputSchema } } };
            }),
          ],
          allowedTools: [...settings.readTools.map((name) => `@gw/${name}`), ...functionTools.map((tool) => `@${tool.name}`)],
        }),
      );
      // ストリームがなければ失敗
      if (stream === undefined) {
        throw new Error('Harness の応答にストリームがありません。');
      }
      const sent = new Set(messages.flatMap((message) => message.content ?? []).flatMap((block) => block.toolResult?.toolUseId ?? []));
      const inline = new Set(functionTools.map((tool) => tool.name));
      return { stream: ReadableStream.from(harnessEvents(stream)).pipeThrough(toStreamParts({ sent, inline })) };
    },
  };
}

// Harness のイベントを順に返します。AWS SDK は、ストリームの中のエラーのイベントを例外として投げるため、受け止めてイベントに戻します。
// 変換では、AI SDK の Bedrock のプロバイダーと同じく、エラーを error の部品にして、止まった理由を error にします。
async function* harnessEvents(stream: AsyncIterable<InvokeHarnessStreamOutput>): AsyncGenerator<InvokeHarnessStreamOutput> {
  try {
    yield* stream;
  } catch (error) {
    // Harness のエラーのイベントだけ戻す。それ以外の例外は投げる
    if (error instanceof RuntimeClientError) {
      yield { runtimeClientError: error };
    } else if (error instanceof ValidationException) {
      yield { validationException: error };
    } else if (error instanceof InternalServerException) {
      yield { internalServerException: error };
    } else {
      throw error;
    }
  }
}

// 交換したトークンで Harness を呼ぶクライアントです。Harness はこのトークンでツールの呼び出しのトークンを交換するため、SigV4 ではなく Bearer で呼びます。
function client(token: string) {
  return new BedrockAgentCoreClient({
    region: env.AWS_REGION,
    httpAuthSchemes: [
      {
        schemeId: 'aws.auth#sigv4',
        identityProvider: () => async () => ({}),
        signer: {
          sign: async (request) => {
            request.headers.authorization = `Bearer ${token}`;
            return request;
          },
        },
      },
    ],
  });
}

// プロンプトの最後のAIの発話より後ろを、Harness に送る発話にします。
function newMessages(prompt: LanguageModelV4Prompt): HarnessMessage[] {
  const content = prompt
    .slice(prompt.findLastIndex((message) => message.role === 'assistant') + 1)
    .flatMap((message): HarnessContentBlock[] => {
      // 利用者の依頼は文だけ
      if (message.role === 'user') {
        return message.content.flatMap((part) => (part.type === 'text' ? [{ text: part.text }] : []));
      }
      // 書込みのツールの結果
      if (message.role === 'tool') {
        return message.content.flatMap((part) => (part.type === 'tool-result' ? [{ toolResult: toolResult(part) }] : []));
      }
      // それ以外は Harness が持っている
      return [];
    });
  return [{ role: HarnessConversationRole.USER, content }];
}

// AI SDK のツールの結果を、Harness のツールの結果にします。AI SDK の Bedrock のプロバイダー（convertToolResultOutput）と同じ変換です。
function toolResult({ toolCallId, output }: LanguageModelV4ToolResultPart): HarnessToolResultBlock {
  return { toolUseId: toolCallId, content: [{ text: toolResultText(output) }] };
}

function toolResultText(output: LanguageModelV4ToolResultOutput) {
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value;
    // やめた書込みは、やめた理由
    case 'execution-denied':
      return output.reason ?? 'Tool call execution denied.';
    default:
      return JSON.stringify(output.value);
  }
}

// 内容のかたまりの状態です。AI SDK の Bedrock のプロバイダーの contentBlocks と同じ持ち方に、Harness が実行したツールの結果を足しています。
type ContentBlock =
  | { type: 'text' }
  | { type: 'reasoning' }
  | { type: 'tool-call'; toolCallId: string; toolName: string; jsonText: string }
  | { type: 'tool-result'; toolCallId: string; toolName: string; isError: boolean; output: string };

// Harness のイベントを、AI SDK のモデルのストリームの部品にします。
// Harness の応答は Bedrock の Converse のストリームと同じ形のため、AI SDK の Bedrock のプロバイダー（@ai-sdk/amazon-bedrock 5.0.149 の doStream）と同じ作りにします。
// Harness のために足した処理には「Harness:」を付けて書きます。
// - sent：BFF から渡した結果の ID（Harness が流し返すため出さない）
// - inline：書込みのツールの名前（それ以外は Harness が実行したツール）
function toStreamParts({ sent, inline }: { sent: Set<string>; inline: Set<string> }) {
  type Controller = TransformStreamDefaultController<LanguageModelV4StreamPart>;
  let finishReason: LanguageModelV4FinishReason = { unified: 'interrupted', raw: undefined };
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheWriteInputTokens: 0 };
  // 使用量を1度でも受け取ったかです。受け取らなければ、使用量は不明として返します。
  let usageReported = false;
  const contentBlocks = new Map<number, ContentBlock>();
  // Harness: 内容の番号は発話ごとに数え直されるため、発話の番号と組にして部品のIDにします。
  let message = 0;
  const partId = (blockIndex: number) => `${message}-${blockIndex}`;
  // Harness: Harness が実行したツールの結果に、呼び出したツールの名前を付けます。
  const toolNames = new Map<string, string>();

  // 内容のかたまりを始める
  function startBlock({ contentBlockIndex: index, start }: HarnessContentBlockStartEvent, controller: Controller) {
    // 番号がなければ扱わない
    if (index === undefined) {
      return;
    }
    const toolUse = start?.toolUse;
    // ツールの呼び出し：入力をため始める
    if (toolUse !== undefined) {
      // ID か名前がなければ扱わない
      if (toolUse.toolUseId === undefined || toolUse.name === undefined) {
        return;
      }
      contentBlocks.set(index, { type: 'tool-call', toolCallId: toolUse.toolUseId, toolName: toolUse.name, jsonText: '' });
      toolNames.set(toolUse.toolUseId, toolUse.name);
      // Harness: Harness が実行するかを付けます。
      controller.enqueue({ type: 'tool-input-start', id: toolUse.toolUseId, toolName: toolUse.name, providerExecuted: !inline.has(toolUse.name), dynamic: true });
      return;
    }
    const toolResult = start?.toolResult;
    // Harness: ツールの結果：Harness が実行した結果をため始める
    if (toolResult !== undefined) {
      const toolName = toolResult.toolUseId === undefined ? undefined : toolNames.get(toolResult.toolUseId);
      // 呼び出しの分からない結果と、BFF から渡した結果はためない
      if (toolResult.toolUseId === undefined || toolName === undefined || sent.has(toolResult.toolUseId)) {
        return;
      }
      contentBlocks.set(index, { type: 'tool-result', toolCallId: toolResult.toolUseId, toolName, isError: toolResult.status === HarnessToolUseStatus.ERROR, output: '' });
      return;
    }
    // それ以外は文
    contentBlocks.set(index, { type: 'text' });
    controller.enqueue({ type: 'text-start', id: partId(index) });
  }

  // 内容のかたまりの続きを受け取る
  function addDelta({ contentBlockIndex: index, delta }: HarnessContentBlockDeltaEvent, controller: Controller) {
    // 番号か中身がなければ扱わない
    if (index === undefined || delta === undefined) {
      return;
    }
    // 回答の文
    if (delta.text) {
      // 始まりなしに来た続きは、ここで始める
      if (!contentBlocks.has(index)) {
        contentBlocks.set(index, { type: 'text' });
        controller.enqueue({ type: 'text-start', id: partId(index) });
      }
      controller.enqueue({ type: 'text-delta', id: partId(index), delta: delta.text });
      return;
    }
    // 考えの文
    if (delta.reasoningContent?.text) {
      // 始まりなしに来た続きは、ここで始める
      if (!contentBlocks.has(index)) {
        contentBlocks.set(index, { type: 'reasoning' });
        controller.enqueue({ type: 'reasoning-start', id: partId(index) });
      }
      controller.enqueue({ type: 'reasoning-delta', id: partId(index), delta: delta.reasoningContent.text });
      return;
    }
    const contentBlock = contentBlocks.get(index);
    // ツールの入力：閉じるときのためにためる
    if (delta.toolUse && contentBlock?.type === 'tool-call') {
      const input = delta.toolUse.input ?? '';
      controller.enqueue({ type: 'tool-input-delta', id: contentBlock.toolCallId, delta: input });
      contentBlock.jsonText += input;
      return;
    }
    // Harness: Harness が実行したツールの結果：閉じるときのためにためる
    if (delta.toolResult && contentBlock?.type === 'tool-result') {
      contentBlock.output += contentText(delta.toolResult);
    }
  }

  // 内容のかたまりを閉じる
  function stopBlock({ contentBlockIndex: index }: HarnessContentBlockStopEvent, controller: Controller) {
    // 番号がなければ閉じるものがない
    if (index === undefined) {
      return;
    }
    const contentBlock = contentBlocks.get(index);
    contentBlocks.delete(index);
    switch (contentBlock?.type) {
      // 文の終わり
      case 'reasoning':
        controller.enqueue({ type: 'reasoning-end', id: partId(index) });
        return;
      case 'text':
        controller.enqueue({ type: 'text-end', id: partId(index) });
        return;
      // ためた入力で呼び出しを出す（書込みのツールは AI SDK が確認カードを出す）
      case 'tool-call':
        controller.enqueue({ type: 'tool-input-end', id: contentBlock.toolCallId });
        controller.enqueue({
          type: 'tool-call',
          toolCallId: contentBlock.toolCallId,
          toolName: contentBlock.toolName,
          input: contentBlock.jsonText === '' ? '{}' : contentBlock.jsonText,
          // Harness: Harness が実行するツール（Gateway のツール）は、プロバイダーが実行したツールとして出します。
          providerExecuted: !inline.has(contentBlock.toolName),
          dynamic: true,
        });
        return;
      // Harness: ためた結果を出す
      case 'tool-result':
        controller.enqueue({ type: 'tool-result', toolCallId: contentBlock.toolCallId, toolName: contentBlock.toolName, result: contentBlock.output, isError: contentBlock.isError, dynamic: true });
        return;
    }
  }

  // Harness: 1回の応答の中でモデルを何度も呼ぶため、使用量を足し合わせます。
  function addUsage(tokens: HarnessTokenUsage) {
    usageReported = true;
    usage.inputTokens += tokens.inputTokens ?? 0;
    usage.outputTokens += tokens.outputTokens ?? 0;
    usage.cacheReadInputTokens += tokens.cacheReadInputTokens ?? 0;
    usage.cacheWriteInputTokens += tokens.cacheWriteInputTokens ?? 0;
  }

  // イベントの種類で分ける
  return new TransformStream<InvokeHarnessStreamOutput, LanguageModelV4StreamPart>({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
    },
    transform(value, controller) {
      const error = value.internalServerException ?? value.validationException ?? value.runtimeClientError;
      // エラーは error の部品にし、終了理由を error にする
      if (error !== undefined) {
        finishReason = { unified: 'error', raw: undefined };
        controller.enqueue({ type: 'error', error });
        return;
      }
      // Harness: 発話の始まりで、内容のかたまりの番号を数え直します。
      if (value.messageStart !== undefined) {
        message += 1;
        contentBlocks.clear();
      }
      // 最後の発話の止まった理由が、回答の終了理由になる
      if (value.messageStop !== undefined) {
        finishReason = { unified: mapFinishReason(value.messageStop.stopReason), raw: value.messageStop.stopReason };
      }
      // 使用量を足し合わせる
      if (value.metadata?.usage !== undefined) {
        addUsage(value.metadata.usage);
      }
      // 内容のかたまりの始まり・続き・終わり
      if (value.contentBlockStart !== undefined) {
        startBlock(value.contentBlockStart, controller);
      }
      if (value.contentBlockDelta !== undefined) {
        addDelta(value.contentBlockDelta, controller);
      }
      if (value.contentBlockStop !== undefined) {
        stopBlock(value.contentBlockStop, controller);
      }
    },
    flush(controller) {
      controller.enqueue({ type: 'finish', finishReason, usage: usageReported ? convertUsage(usage) : createNullLanguageModelUsage() });
    },
  });
}

// 使用量を AI SDK の形にします。AI SDK の Bedrock のプロバイダーの convertAmazonBedrockUsage と同じ計算です。
function convertUsage(usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheWriteInputTokens: number }): LanguageModelV4Usage {
  return {
    inputTokens: {
      total: usage.inputTokens + usage.cacheReadInputTokens + usage.cacheWriteInputTokens,
      noCache: usage.inputTokens,
      cacheRead: usage.cacheReadInputTokens,
      cacheWrite: usage.cacheWriteInputTokens,
    },
    outputTokens: { total: usage.outputTokens, text: usage.outputTokens, reasoning: undefined },
    raw: usage,
  };
}

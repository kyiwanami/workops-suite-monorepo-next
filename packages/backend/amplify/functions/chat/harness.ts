import { env } from '$amplify/env/chat';
import {
  type LanguageModelV4,
  type LanguageModelV4FinishReason,
  type LanguageModelV4Prompt,
  type LanguageModelV4StreamPart,
  type LanguageModelV4ToolResultPart,
  type LanguageModelV4Usage,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import {
  BedrockAgentCoreClient,
  HarnessConversationRole,
  type HarnessContentBlock,
  type HarnessMessage,
  HarnessStopReason,
  type HarnessTool,
  type HarnessToolResultBlock,
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

// Harness が止まった理由を、AI SDK の終了理由にします。Harness の止まった理由は Bedrock の Converse と同じ値のため、
// AI SDK の Bedrock のプロバイダー（@ai-sdk/amazon-bedrock の mapAmazonBedrockFinishReason。公開されていない）と同じ読み替えにします。
function mapFinishReason(stopReason: HarnessStopReason | undefined): LanguageModelV4FinishReason['unified'] {
  switch (stopReason) {
    case HarnessStopReason.STOP_SEQUENCE:
    case HarnessStopReason.END_TURN:
      return 'stop';
    case HarnessStopReason.MAX_TOKENS:
      return 'length';
    case HarnessStopReason.CONTENT_FILTERED:
      return 'content-filter';
    case HarnessStopReason.TOOL_USE:
      return 'tool-calls';
    default:
      return 'other';
  }
}

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
              if (!isSpecType.JSONObject(inputSchema)) {
                throw new Error(`ツールの入力スキーマが JSON ではありません：${tool.name}`);
              }
              return { type: HarnessToolType.INLINE_FUNCTION, name: tool.name, config: { inlineFunction: { description: tool.description ?? tool.name, inputSchema } } };
            }),
          ],
          allowedTools: [...settings.readTools.map((name) => `@gw/${name}`), ...functionTools.map((tool) => `@${tool.name}`)],
        }),
      );
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
      if (message.role === 'user') {
        return message.content.flatMap((part) => (part.type === 'text' ? [{ text: part.text }] : []));
      }
      if (message.role === 'tool') {
        return message.content.flatMap((part) => (part.type === 'tool-result' ? [{ toolResult: toolResult(part) }] : []));
      }
      return [];
    });
  return [{ role: HarnessConversationRole.USER, content }];
}

// AI SDK のツールの結果を、Harness のツールの結果にします。Harness はツールの結果を文で受け取ります。
// 利用者が取り消した結果は、AI SDK の結果をそのまま JSON の文にして渡します。
function toolResult({ toolCallId, output }: LanguageModelV4ToolResultPart): HarnessToolResultBlock {
  if (output.type === 'execution-denied') {
    return { toolUseId: toolCallId, status: HarnessToolUseStatus.ERROR, content: [{ text: JSON.stringify(output) }] };
  }
  const isError = output.type === 'error-text' || output.type === 'error-json';
  const text = output.type === 'text' || output.type === 'error-text' ? output.value : JSON.stringify(output.value);
  return { toolUseId: toolCallId, status: isError ? HarnessToolUseStatus.ERROR : HarnessToolUseStatus.SUCCESS, content: [{ text }] };
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
function toStreamParts({ sent, inline }: { sent: Set<string>; inline: Set<string> }) {
  let finishReason: LanguageModelV4FinishReason = { unified: 'interrupted', raw: undefined };
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheWriteInputTokens: 0 };
  const contentBlocks = new Map<number, ContentBlock>();
  // Harness: 内容の番号は発話ごとに数え直されるため、発話の番号と組にして部品のIDにします。
  let message = 0;
  const partId = (blockIndex: number) => `${message}-${blockIndex}`;
  // Harness: Harness が実行したツールの結果に、呼び出したツールの名前を付けます。
  const toolNames = new Map<string, string>();

  return new TransformStream<InvokeHarnessStreamOutput, LanguageModelV4StreamPart>({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
    },
    transform(value, controller) {
      const error = value.internalServerException ?? value.validationException ?? value.runtimeClientError;
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
      if (value.messageStop !== undefined) {
        finishReason = { unified: mapFinishReason(value.messageStop.stopReason), raw: value.messageStop.stopReason };
      }
      // Harness: 1回の応答の中でモデルを何度も呼ぶため、使用量を足し合わせます。
      if (value.metadata?.usage !== undefined) {
        usage.inputTokens += value.metadata.usage.inputTokens ?? 0;
        usage.outputTokens += value.metadata.usage.outputTokens ?? 0;
        usage.cacheReadInputTokens += value.metadata.usage.cacheReadInputTokens ?? 0;
        usage.cacheWriteInputTokens += value.metadata.usage.cacheWriteInputTokens ?? 0;
      }
      const contentBlockStart = value.contentBlockStart;
      if (contentBlockStart?.contentBlockIndex !== undefined && contentBlockStart.start?.toolUse === undefined && contentBlockStart.start?.toolResult === undefined) {
        contentBlocks.set(contentBlockStart.contentBlockIndex, { type: 'text' });
        controller.enqueue({ type: 'text-start', id: partId(contentBlockStart.contentBlockIndex) });
      }
      const contentBlockDelta = value.contentBlockDelta;
      if (contentBlockDelta?.contentBlockIndex !== undefined && contentBlockDelta.delta?.text) {
        const blockIndex = contentBlockDelta.contentBlockIndex;
        if (!contentBlocks.has(blockIndex)) {
          contentBlocks.set(blockIndex, { type: 'text' });
          controller.enqueue({ type: 'text-start', id: partId(blockIndex) });
        }
        controller.enqueue({ type: 'text-delta', id: partId(blockIndex), delta: contentBlockDelta.delta.text });
      }
      if (value.contentBlockStop?.contentBlockIndex !== undefined) {
        const blockIndex = value.contentBlockStop.contentBlockIndex;
        const contentBlock = contentBlocks.get(blockIndex);
        if (contentBlock?.type === 'reasoning') {
          controller.enqueue({ type: 'reasoning-end', id: partId(blockIndex) });
        } else if (contentBlock?.type === 'text') {
          controller.enqueue({ type: 'text-end', id: partId(blockIndex) });
        } else if (contentBlock?.type === 'tool-call') {
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
        } else if (contentBlock?.type === 'tool-result') {
          // Harness: Harness が実行したツールの結果を出します。
          controller.enqueue({ type: 'tool-result', toolCallId: contentBlock.toolCallId, toolName: contentBlock.toolName, result: contentBlock.output, isError: contentBlock.isError, dynamic: true });
        }
        contentBlocks.delete(blockIndex);
      }
      if (contentBlockDelta?.contentBlockIndex !== undefined && contentBlockDelta.delta?.reasoningContent?.text) {
        const blockIndex = contentBlockDelta.contentBlockIndex;
        if (!contentBlocks.has(blockIndex)) {
          contentBlocks.set(blockIndex, { type: 'reasoning' });
          controller.enqueue({ type: 'reasoning-start', id: partId(blockIndex) });
        }
        controller.enqueue({ type: 'reasoning-delta', id: partId(blockIndex), delta: contentBlockDelta.delta.reasoningContent.text });
      }
      const toolUse = contentBlockStart?.start?.toolUse;
      if (contentBlockStart?.contentBlockIndex !== undefined && toolUse?.toolUseId !== undefined && toolUse.name !== undefined) {
        contentBlocks.set(contentBlockStart.contentBlockIndex, { type: 'tool-call', toolCallId: toolUse.toolUseId, toolName: toolUse.name, jsonText: '' });
        toolNames.set(toolUse.toolUseId, toolUse.name);
        // Harness: Harness が実行するかを付けます。
        controller.enqueue({ type: 'tool-input-start', id: toolUse.toolUseId, toolName: toolUse.name, providerExecuted: !inline.has(toolUse.name), dynamic: true });
      }
      if (contentBlockDelta?.contentBlockIndex !== undefined && contentBlockDelta.delta?.toolUse) {
        const contentBlock = contentBlocks.get(contentBlockDelta.contentBlockIndex);
        if (contentBlock?.type === 'tool-call') {
          const delta = contentBlockDelta.delta.toolUse.input ?? '';
          controller.enqueue({ type: 'tool-input-delta', id: contentBlock.toolCallId, delta });
          contentBlock.jsonText += delta;
        }
      }
      // Harness: Harness が実行したツールの結果をためます。BFF から渡した結果は Harness が流し返すため、ためません。
      const toolResult = contentBlockStart?.start?.toolResult;
      const toolName = toolResult?.toolUseId === undefined ? undefined : toolNames.get(toolResult.toolUseId);
      if (contentBlockStart?.contentBlockIndex !== undefined && toolResult?.toolUseId !== undefined && toolName !== undefined && !sent.has(toolResult.toolUseId)) {
        contentBlocks.set(contentBlockStart.contentBlockIndex, {
          type: 'tool-result',
          toolCallId: toolResult.toolUseId,
          toolName,
          isError: toolResult.status === HarnessToolUseStatus.ERROR,
          output: '',
        });
      }
      if (contentBlockDelta?.contentBlockIndex !== undefined && contentBlockDelta.delta?.toolResult) {
        const contentBlock = contentBlocks.get(contentBlockDelta.contentBlockIndex);
        if (contentBlock?.type === 'tool-result') {
          contentBlock.output += contentBlockDelta.delta.toolResult.map((item) => item.text ?? JSON.stringify(item.json)).join('');
        }
      }
    },
    flush(controller) {
      controller.enqueue({ type: 'finish', finishReason, usage: convertUsage(usage) });
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
  };
}

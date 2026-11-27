import { env } from '$amplify/env/chat';
import {
  BedrockAgentCoreClient,
  type Event,
  type HarnessMessage,
  type HarnessToolResultBlock,
  type HarnessToolUseBlock,
  paginateListEvents,
  paginateListSessions,
} from '@aws-sdk/client-bedrock-agentcore';
import type { JSONObject } from '@ai-sdk/provider';
import type { toolApproval } from '@workops/blocks/schema';
import type { UIMessage } from 'ai';
import { z } from 'zod';

const agentCore = new BedrockAgentCoreClient({ region: env.AWS_REGION });

// Harness が会話のイベントに JSON の文字列で記録する発話です。保存の形式は公開されていないため、SDK の発話の型に合うことを検証して読みます。
const recordSchema = z.object({
  message: z.object({
    role: z.enum(['user', 'assistant']),
    content: z.array(
      z.union([
        z.object({ text: z.string() }),
        z.object({ reasoningContent: z.object({ reasoningText: z.object({ text: z.string() }) }) }),
        z.object({ toolUse: z.object({ toolUseId: z.string(), name: z.string(), input: z.json() }) }),
        z.object({
          toolResult: z.object({
            toolUseId: z.string(),
            status: z.enum(['success', 'error']).optional(),
            content: z.array(z.union([z.object({ text: z.string() }), z.object({ json: z.json() })])),
          }),
        }),
      ]),
    ),
  }),
}) satisfies z.ZodType<{ message: HarnessMessage }>;

// Harness のセッションのIDです。他人の会話を開けないように、利用者の sub を前に付けます。
export const sessionId = (sub: string, conversationId: string) => `${sub}_${conversationId}`;

// 利用者の会話の一覧です。新しい順に返します。
export async function listConversations(sub: string) {
  const conversations = [];
  for await (const page of paginateListSessions({ client: agentCore }, { memoryId: env.MEMORY_ID, actorId: sub })) {
    for (const session of page.sessionSummaries ?? []) {
      conversations.push({ conversationId: session.sessionId?.slice(sub.length + 1), createdAt: session.createdAt });
    }
  }
  return conversations.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

// 会話のイベントを、古い順に返します。
export async function listEvents(sub: string, conversationId: string) {
  const events: Event[] = [];
  for await (const page of paginateListEvents(
    { client: agentCore },
    { memoryId: env.MEMORY_ID, actorId: sub, sessionId: sessionId(sub, conversationId), includePayloads: true },
  )) {
    events.push(...(page.events ?? []));
  }
  return events.sort((a, b) => Number(a.eventTimestamp) - Number(b.eventTimestamp));
}

// 会話のイベントから、発話を古い順に取り出します。
export function toMessages(events: Event[]): HarnessMessage[] {
  return events
    .flatMap((event) => event.payload ?? [])
    .flatMap((payload) => {
      const text = payload.conversational?.content?.text;
      // 発話でないイベントは飛ばす
      return text === undefined ? [] : [recordSchema.parse(JSON.parse(text)).message];
    });
}

// 確認待ちのツールの呼び出しです。最後のAIの発話のツールの呼び出しのうち、結果がまだないものを返します。
// 読み取りのツールは Harness が実行して結果を残すため、結果のないものは確認カードを経る書込みのツールです。
export function pendingToolUses(messages: HarnessMessage[]) {
  const answered = new Set(messages.flatMap((message) => message.content ?? []).flatMap((block) => block.toolResult?.toolUseId ?? []));
  const last = messages.findLast((message) => message.role === 'assistant');
  // 文などと、結果のある呼び出しは除く
  return (last?.content ?? []).flatMap(({ toolUse }) =>
    toolUse?.toolUseId === undefined || toolUse.name === undefined || answered.has(toolUse.toolUseId)
      ? []
      : [{ toolUseId: toolUse.toolUseId, name: toolUse.name, input: toolUse.input }],
  );
}

// 会話の発話を、画面の AI SDK のメッセージにします。利用者の依頼のあとのAIの発話とツールの結果は、1つのAIのメッセージにまとめます。
export function toUIMessages(
  messages: HarnessMessage[],
  metadata: Map<string, JSONObject>,
  approvals: Map<string, typeof toolApproval.$inferSelect>,
  readTools: Set<string>,
) {
  const results = new Map(
    messages.flatMap((message) => message.content ?? []).flatMap((block) => (block.toolResult?.toolUseId === undefined ? [] : [[block.toolResult.toolUseId, block.toolResult]])),
  );
  const uiMessages: UIMessage[] = [];
  messages.forEach((message, index) => {
    const content = message.content ?? [];
    // 利用者の依頼
    if (message.role === 'user' && content.some((block) => block.text !== undefined)) {
      uiMessages.push({ id: `${index}`, role: 'user', parts: content.flatMap((block) => (block.text === undefined ? [] : [{ type: 'text', text: block.text }])) });
      return;
    }
    // AIの発話とツールの結果は、直前のAIのメッセージにまとめる
    const last = uiMessages.at(-1);
    const assistant: UIMessage = last?.role === 'assistant' ? last : { id: `${index}`, role: 'assistant', parts: [] };
    if (assistant !== last) {
      uiMessages.push(assistant);
    }
    for (const block of content) {
      if (block.text !== undefined) {
        assistant.parts.push({ type: 'text', text: block.text });
      }
      // ツールの結果は呼び出しの部品に入れる
      if (block.toolUse !== undefined) {
        pushToolParts(assistant, block.toolUse, { results, approvals, metadata, readTools });
      }
    }
  });
  return uiMessages;
}

// ツールの呼び出しを部品にして足す。状態はツールの結果と確認カードの記録で決める
function pushToolParts(
  assistant: UIMessage,
  toolUse: HarnessToolUseBlock,
  history: {
    results: Map<string, HarnessToolResultBlock>;
    approvals: Map<string, typeof toolApproval.$inferSelect>;
    metadata: Map<string, JSONObject>;
    readTools: Set<string>;
  },
) {
  const { toolUseId, name, input } = toolUse;
  // ID か名前がなければ飛ばす
  if (toolUseId === undefined || name === undefined) {
    return;
  }
  const result = history.results.get(toolUseId);
  const approval = history.approvals.get(toolUseId);
  const toolMetadata = history.metadata.get(name);
  const common = {
    toolCallId: toolUseId,
    toolName: name,
    input,
    // 読み取りのツールは確認カードにしない
    providerExecuted: history.readTools.has(name),
    ...(toolMetadata === undefined ? {} : { toolMetadata }),
  };
  const output = (result?.content ?? []).map((item) => item.text ?? JSON.stringify(item.json)).join('');
  const status = approval?.status;
  if (result === undefined) {
    // 判断待ち
    assistant.parts.push({ type: 'dynamic-tool', ...common, state: 'approval-requested', approval: { id: toolUseId } });
  } else if (status === 'denied' || status === 'abandoned') {
    // やめた・判断せずに次の依頼をした
    assistant.parts.push({ type: 'dynamic-tool', ...common, state: 'output-denied', approval: { id: toolUseId, approved: false } });
  } else if (status === 'failed' || result.status === 'error') {
    // 失敗
    assistant.parts.push({ type: 'dynamic-tool', ...common, state: 'output-error', errorText: output });
  } else {
    // 成功
    assistant.parts.push({ type: 'dynamic-tool', ...common, state: 'output-available', output });
  }

  // 記録がない（読み取りのツール）
  if (approval === undefined) {
    return;
  }
  // 変更前の表示に使う対象の値
  if (approval.target !== null) {
    assistant.parts.push({ type: 'data-target', id: toolUseId, data: approval.target });
  }
  // ID の代わりに出す名前
  if (approval.names !== null) {
    assistant.parts.push({ type: 'data-names', id: toolUseId, data: approval.names });
  }
  // 実行を終えたカードの日時
  if (status === 'succeeded' || status === 'failed') {
    assistant.parts.push({ type: 'data-result', id: toolUseId, data: { at: approval.updatedAt } });
  }
}

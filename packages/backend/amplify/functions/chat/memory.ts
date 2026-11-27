import { env } from '$amplify/env/chat';
import { BedrockAgentCoreClient, type Event, type HarnessMessage, paginateListEvents, paginateListSessions } from '@aws-sdk/client-bedrock-agentcore';
import type { JSONObject } from '@ai-sdk/provider';
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
      return text === undefined ? [] : [recordSchema.parse(JSON.parse(text)).message];
    });
}

// 確認待ちのツールの呼び出しです。最後のAIの発話のツールの呼び出しのうち、結果がまだないものを返します。
// 読み取りのツールは Harness が実行して結果を残すため、結果のないものは確認カードを経る書込みのツールです。
export function pendingToolUses(messages: HarnessMessage[]) {
  const answered = new Set(messages.flatMap((message) => message.content ?? []).flatMap((block) => block.toolResult?.toolUseId ?? []));
  const last = messages.findLast((message) => message.role === 'assistant');
  return (last?.content ?? []).flatMap(({ toolUse }) =>
    toolUse?.toolUseId === undefined || toolUse.name === undefined || answered.has(toolUse.toolUseId)
      ? []
      : [{ toolUseId: toolUse.toolUseId, name: toolUse.name, input: toolUse.input }],
  );
}

// 会話の発話を、画面の AI SDK のメッセージにします。利用者の依頼のあとのAIの発話とツールの結果は、1つのAIのメッセージにまとめます。
// ツールの部品には、ツールの情報（MCP の表示名と注釈）を付けます。
// 結果のないツールの呼び出しは承認の要求の状態に、確認カードの判断の記録で取り消したものは取り消しの状態にします。
export function toUIMessages(messages: HarnessMessage[], metadata: Map<string, JSONObject>, denied: Set<string>) {
  const results = new Map(
    messages.flatMap((message) => message.content ?? []).flatMap((block) => (block.toolResult?.toolUseId === undefined ? [] : [[block.toolResult.toolUseId, block.toolResult]])),
  );
  const uiMessages: UIMessage[] = [];
  messages.forEach((message, index) => {
    const content = message.content ?? [];
    if (message.role === 'user' && content.some((block) => block.text !== undefined)) {
      uiMessages.push({ id: `${index}`, role: 'user', parts: content.flatMap((block) => (block.text === undefined ? [] : [{ type: 'text', text: block.text }])) });
      return;
    }
    const last = uiMessages.at(-1);
    const assistant: UIMessage = last?.role === 'assistant' ? last : { id: `${index}`, role: 'assistant', parts: [] };
    if (assistant !== last) {
      uiMessages.push(assistant);
    }
    for (const block of content) {
      if (block.text !== undefined) {
        assistant.parts.push({ type: 'text', text: block.text });
      } else if (block.toolUse?.toolUseId !== undefined && block.toolUse.name !== undefined) {
        const { toolUseId, name, input } = block.toolUse;
        const result = results.get(toolUseId);
        const output = (result?.content ?? []).map((item) => item.text ?? JSON.stringify(item.json)).join('');
        const toolMetadata = metadata.get(name);
        const common = { type: 'dynamic-tool', toolCallId: toolUseId, toolName: name, input, ...(toolMetadata === undefined ? {} : { toolMetadata }) } as const;
        assistant.parts.push(
          result === undefined
            ? { ...common, state: 'approval-requested', approval: { id: toolUseId } }
            : denied.has(toolUseId)
              ? { ...common, state: 'output-denied', approval: { id: toolUseId, approved: false } }
              : result.status === 'error'
                ? { ...common, state: 'output-error', errorText: output }
                : { ...common, state: 'output-available', output },
        );
      }
    }
  });
  return uiMessages;
}

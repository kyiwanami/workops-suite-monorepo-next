import { env } from '$amplify/env/chat';
import { type Event, UnauthorizedException } from '@aws-sdk/client-bedrock-agentcore';
import { ApplyGuardrailCommand, BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import type { MCPClient } from '@ai-sdk/mcp';
import { streamHandle } from '@hono/aws-lambda';
import { isSpecType } from '@modelcontextprotocol/client';
import { listAppUrls } from '@workops/domain/apps';
import { createDatabase } from '@workops/domain/database';
import { getMembership } from '@workops/domain/membership';
import { closeToolRequests, listToolApprovals, recordToolDecisions, recordToolRequests, recordToolResult } from '@workops/domain/tool-approvals';
import { chatSchema, dataPartSchemas } from '@workops/schema/chat';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  isTextUIPart,
  isToolUIPart,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type ToolSet,
  type TypedToolCall,
  type UIMessageStreamWriter,
} from 'ai';
import type { APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';
import { connectGateway, exchangeToken, listGatewayTools } from './gateway';
import { readNames, readTarget } from './cards';
import { createHarnessModel } from './harness';
import { type ChatMessage, listConversations, listEvents, pendingToolUses, sessionId, toMessages, toUIMessages } from './memory';

const bedrock = new BedrockRuntimeClient({ region: env.AWS_REGION });
const db = createDatabase({
  region: env.AWS_REGION,
  database: env.DATABASE_NAME,
  secretArn: env.SECRET_ARN,
  resourceArn: env.CLUSTER_ARN,
});

// チャットのAPIを呼べるアプリのオリジンです。登録されたアプリのURLから作り、実行環境の中で使い回します。
const allowedOrigins = listAppUrls(db).then((urls) => new Set(urls.map((url) => new URL(url).origin)));

const messages = {
  forbidden: '利用者を確認できませんでした。',
  invalid: '依頼の内容を確認してください。',
  blocked: 'この依頼には対応できません。依頼の内容を見直してください。',
  conflict: '確認待ちの操作が見つからないか、すでに判断済みか、期限が切れています。',
  failed: '回答を作れませんでした。時間をおいて、もう一度お試しください。',
  denied: '利用者がキャンセルしたため、実行していません。',
  abandoned: '利用者が判断せずに次の依頼をしたため、実行していません。',
};

// 構造化ログです。会話の本文とトークンは出しません。
const log = (entry: object) => console.log(JSON.stringify(entry));

// チャットのAPIです。画面とは AI SDK の UI Message Stream Protocol でやり取りし、回答を逐次返します。
// 書込みのツールは、AI SDK のツールの承認（確認カード）で利用者が承認してから実行します。
const app = new Hono<{ Bindings: { event: APIGatewayProxyWithCognitoAuthorizerEvent }; Variables: { sub: string; userToken: string } }>();

// 登録したアプリのオリジンだけ許可する
app.use(cors({ origin: async (origin) => ((await allowedOrigins).has(origin) ? origin : null), exposeHeaders: ['x-vercel-ai-ui-message-stream'] }));

// 利用者のトークンだけを受け付けます。マシン間の認可のトークンには principal_type が入りません。
app.use(async (c, next) => {
  const { sub, principal_type: principalType } = c.env.event.requestContext.authorizer.claims;
  const userToken = c.req.header('authorization')?.replace(/^Bearer /i, '');
  // 利用者のトークンでなければ 403
  if (principalType !== 'user' || userToken === undefined) {
    return c.json({ message: messages.forbidden }, 403);
  }
  c.set('sub', sub);
  c.set('userToken', userToken);
  await next();
});

app.onError((error, c) => {
  console.error(error);
  // トークンを交換できない（期限が近い）ときは 401。画面がトークンを取り直して送り直す
  if (error instanceof UnauthorizedException) {
    return c.json({ message: messages.forbidden }, 401);
  }
  return c.json({ message: messages.failed }, 500);
});

app.get('/conversations', async (c) => c.json({ conversations: await listConversations(c.get('sub')) }));

// 会話の履歴です。ツールの名前を表示名にするため、利用者として Gateway のツールの一覧を取ります。
app.get('/conversations/:conversationId', async (c) => {
  const gateway = await connectGateway(await exchangeToken(c.get('userToken')));
  try {
    const { readTools, tools } = await listGatewayTools(gateway);
    const metadata = new Map(Object.entries(tools).flatMap(([name, tool]) => (tool.metadata === undefined ? [] : [[name, tool.metadata]])));
    const sub = c.get('sub');
    const conversationId = c.req.param('conversationId');
    // 確認カードの記録（状態・対象の値・名前・実行の日時）
    const approvals = new Map((await listToolApprovals(db, sub, conversationId)).map((approval) => [approval.toolUseId, approval]));
    return c.json({ messages: toUIMessages(toMessages(await listEvents(sub, conversationId)), metadata, approvals, new Set(readTools)) });
  } finally {
    await gateway.close();
  }
});

// 会話のIDと最後のメッセージを受け取ります。メッセージの形は AI SDK で検証します。
// 利用者のメッセージは依頼、AIのメッセージは確認カードの判断として受け付けます。
app.post(
  '/chat',
  validator('json', (value, c) => {
    const parsed = chatSchema.safeParse(value);
    // 形の違う要求は 400
    return parsed.success ? parsed.data : c.json({ message: messages.invalid }, 400);
  }),
  async (c) => {
    const { id: conversationId, message: body } = c.req.valid('json');
    const validated = await safeValidateUIMessages<ChatMessage>({ messages: [body], dataSchemas: dataPartSchemas });
    const message = validated.success ? validated.data.at(0) : undefined;
    // AI SDK のメッセージでなければ 400
    if (message === undefined) {
      return c.json({ message: messages.invalid }, 400);
    }
    const request = { sub: c.get('sub'), conversationId, userToken: c.get('userToken'), message };
    // 利用者のメッセージは依頼、AIのメッセージは確認カードの判断
    return message.role === 'user' ? acceptRequest(request) : acceptDecisions(request);
  },
);

// 受け付けたメッセージと、送った利用者です。
type ChatRequest = { sub: string; conversationId: string; userToken: string; message: ChatMessage };

// 利用者の依頼を Harness に渡す
async function acceptRequest({ sub, conversationId, userToken, message }: ChatRequest) {
  // プロンプト攻撃は AI に渡さず 400
  if (await isAttack(sub, conversationId, message)) {
    return Response.json({ message: messages.blocked }, { status: 400 });
  }
  const pending = pendingToolUses(toMessages(await listEvents(sub, conversationId)));
  const prepared = await prepare(userToken);
  // 判断待ちのカードがなければ、依頼だけ渡す
  if (pending.length === 0) {
    return converse({ sub, conversationId, ...prepared, message, prompts: [message] });
  }
  // 判断待ちのカードは実行しない。abandoned にし、実行していない結果を依頼の前に付ける（結果がないと Harness が再開できない）
  // 準備のあとに記録する（準備に失敗しても判断待ちのまま残る）。記録に失敗したら接続を閉じる
  await closeToolRequests(
    db,
    sub,
    pending.map((toolUse) => toolUse.toolUseId),
    'abandoned',
  ).catch(async (error) => {
    await prepared.gateway.close();
    throw error;
  });
  const abandoned: ChatMessage = {
    id: generateId(),
    role: 'assistant',
    parts: pending.map((toolUse) => ({
      type: 'dynamic-tool',
      toolCallId: toolUse.toolUseId,
      toolName: toolUse.name,
      input: toolUse.input,
      state: 'output-denied',
      approval: { id: toolUse.toolUseId, approved: false, reason: messages.abandoned },
    })),
  };
  return converse({ sub, conversationId, ...prepared, message, prompts: [abandoned, message] });
}

// Bedrock Guardrails でプロンプト攻撃を調べる。検知したら種類と信頼度をログに出す
async function isAttack(sub: string, conversationId: string, message: ChatMessage) {
  const text = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('\n');
  const guardrail = await bedrock.send(
    new ApplyGuardrailCommand({ guardrailIdentifier: env.GUARDRAIL_ID, guardrailVersion: env.GUARDRAIL_VERSION, source: 'INPUT', outputScope: 'FULL', content: [{ text: { text } }] }),
  );
  // 介入しなければ攻撃ではない
  if (guardrail.action !== 'GUARDRAIL_INTERVENED') {
    return false;
  }
  const filter = guardrail.assessments?.flatMap((assessment) => assessment.contentPolicy?.filters ?? []).at(0);
  log({ sub, conversationId, event: 'guardrail', guardrail: 'intervened', guardrailAssessment: { filter: filter?.type, confidence: filter?.confidence } });
  return true;
}

// 確認カードの判断を受け付け、承認された書込みを実行する
// ツール名と入力は会話履歴から取る
async function acceptDecisions({ sub, conversationId, userToken, message }: ChatRequest) {
  const events = await listEvents(sub, conversationId);
  const decisions = matchDecisions(events, message);
  // 判断待ちのカードと合わない判断は 409
  if (decisions === null) {
    return Response.json({ message: messages.conflict }, { status: 409 });
  }
  // 待機の上限切れは Harness が再開できないため、expired にして 409
  if (isExpired(events)) {
    await closeToolRequests(
      db,
      sub,
      decisions.map(({ toolUse }) => toolUse.toolUseId),
      'expired',
    );
    return Response.json({ message: messages.conflict }, { status: 409 });
  }
  // 準備は判断の記録より前に済ませる（失敗しても判断待ちのまま残る）。記録に失敗したら接続を閉じる
  const prepared = await prepare(userToken);
  const recorded = await recordToolDecisions(
    db,
    sub,
    decisions.map(({ toolUse, approval }) => ({ toolUseId: toolUse.toolUseId, status: approval.approved ? 'approved' : 'denied' })),
  ).catch(async (error) => {
    await prepared.gateway.close();
    throw error;
  });
  // 判断済みのカードへの2回目の判断は 409（二重実行を防ぐ）
  if (!recorded) {
    await prepared.gateway.close();
    return Response.json({ message: messages.conflict }, { status: 409 });
  }
  for (const { toolUse, approval } of decisions) {
    log({ sub, conversationId, event: 'decision', tool: toolUse.name, toolUseId: toolUse.toolUseId, decision: approval.approved ? 'approved' : 'denied' });
  }
  const prompt: ChatMessage = {
    id: message.id,
    role: 'assistant',
    parts: decisions.map(({ toolUse, approval }) => ({
      type: 'dynamic-tool',
      toolCallId: toolUse.toolUseId,
      toolName: toolUse.name,
      input: toolUse.input,
      state: 'approval-responded',
      // やめた理由は BFF で決める（画面から来た文は Guardrail を通っていない）
      approval: approval.approved ? { id: approval.id, approved: true } : { id: approval.id, approved: false, reason: messages.denied },
    })),
  };
  return converse({ sub, conversationId, ...prepared, message, prompts: [prompt] });
}

// 画面の判断を、会話の判断待ちの呼び出しと組にする
function matchDecisions(events: Event[], message: ChatMessage) {
  const pending = pendingToolUses(toMessages(events));
  const approvals = new Map(message.parts.filter(isToolUIPart).flatMap((part) => (part.state === 'approval-responded' ? [[part.toolCallId, part.approval]] : [])));
  const decisions = pending.flatMap((toolUse) => {
    const approval = approvals.get(toolUse.toolUseId);
    return approval === undefined ? [] : [{ toolUse, approval }];
  });
  // 判断待ちの全部に判断がそろわない、または判断待ちでない呼び出しへの判断を含むなら null
  if (decisions.length === 0 || decisions.length !== pending.length || decisions.length !== approvals.size) {
    return null;
  }
  return decisions;
}

// Harness のセッションの待機の上限を過ぎたか
function isExpired(events: Event[]) {
  const lastEventAt = events.at(-1)?.eventTimestamp;
  // イベントがなければ再開できるセッションもない
  if (lastEventAt === undefined) {
    return true;
  }
  return Date.now() - lastEventAt.getTime() > Number(env.HARNESS_IDLE_TIMEOUT) * 1000;
}

// Harness を呼ぶ準備です。利用者のトークンを交換し、利用者として Gateway に接続して、呼べるツールを取ります。
async function prepare(userToken: string) {
  const token = await exchangeToken(userToken);
  const gateway = await connectGateway(token);
  try {
    return { token, gateway, ...(await listGatewayTools(gateway)) };
  } catch (error) {
    // ツールを取れなければ接続を閉じる
    await gateway.close();
    throw error;
  }
}

// 確認カードを対象の値・名前と一緒に記録し、カードに添える
// 対象の値と名前は、画面と業務MCPサーバーと同じ業務の処理で、利用者の所属で読む
async function recordCards(input: {
  sub: string;
  conversationId: string;
  writer: UIMessageStreamWriter<ChatMessage>;
  toolCalls: Array<TypedToolCall<ToolSet>>;
}) {
  const { sub, conversationId, writer } = input;
  const now = new Date().toISOString();
  const member = await getMembership(db, sub);
  const context = member === null ? null : { db, member };
  const cards = await Promise.all(
    input.toolCalls.map(async (toolCall) => {
      const target = context === null ? null : await readTarget(context, toolCall.toolName, toolCall.input);
      const names = context === null ? null : await readNames(context, toolCall.toolName, toolCall.input, target);
      return { toolCall, target, names };
    }),
  );
  await recordToolRequests(
    db,
    cards.map(({ toolCall, target, names }) => ({
      toolUseId: toolCall.toolCallId,
      conversationId,
      toolName: toolCall.toolName,
      input: toolCall.input,
      target,
      names,
      status: 'requested',
      createdAt: now,
      createdBy: sub,
      updatedAt: now,
      updatedBy: sub,
    })),
  );
  // 取れた値だけ送る
  for (const { toolCall, target, names } of cards) {
    if (target !== null) {
      writer.write({ type: 'data-target', id: toolCall.toolCallId, data: target });
    }
    if (names !== null) {
      writer.write({ type: 'data-names', id: toolCall.toolCallId, data: names });
    }
  }
}

// Harness に依頼か判断を渡し、回答を AI SDK の UI Message Stream で返します。
// 承認された書込みのツールは、AI SDK が利用者として Gateway で実行し、結果を判断の記録に残します。
// カードには対象の値（data-target）・ID の名前（data-names）・実行の日時（data-result）を添える
async function converse(input: {
  sub: string;
  conversationId: string;
  message: ChatMessage;
  prompts: ChatMessage[];
  token: string;
  gateway: MCPClient;
  readTools: string[];
  tools: ToolSet;
}) {
  const { sub, conversationId, token, gateway, readTools, tools } = input;
  const prompt = await convertToModelMessages(input.prompts);
  // 失敗を記録し、画面に返す文言
  const failed = () => {
    log({ sub, conversationId, event: 'invoke', error: 'failed' });
    return messages.failed;
  };
  const stream = createUIMessageStream<ChatMessage>({
    originalMessages: [input.message],
    generateId,
    onError: (error) => {
      console.error(error);
      return failed();
    },
    execute: ({ writer }) => {
      const result = streamText({
        model: createHarnessModel({ token, runtimeSessionId: sessionId(sub, conversationId), actorId: sub, readTools }),
        messages: prompt,
        tools,
        // 読み取りのツール（MCP の readOnlyHint が true）は承認なしで、それ以外は利用者の承認を求めます。Harness に渡す読み取りのツールの名前で判定します。
        toolApproval: ({ toolCall }) => (readTools.includes(toolCall.toolName) ? 'not-applicable' : 'user-approval'),
        // 承認を求めた呼び出しの確認カードを記録する
        onStepEnd: ({ content }) =>
          recordCards({ sub, conversationId, writer, toolCalls: content.flatMap((part) => (part.type === 'tool-approval-request' ? [part.toolCall] : [])) }),
        // 実行の結果を記録し、日時をカードに添える。ツールが失敗を返したら failed
        onToolExecutionEnd: async ({ toolCall, toolOutput }) => {
          const failed = toolOutput.type === 'tool-error' || (isSpecType.CallToolResult(toolOutput.output) && toolOutput.output.isError === true);
          await recordToolResult(db, sub, toolCall.toolCallId, failed ? 'failed' : 'succeeded');
          writer.write({ type: 'data-result', id: toolCall.toolCallId, data: { at: new Date().toISOString() } });
        },
        onEnd: ({ finishReason, usage }) => {
          log({ sub, conversationId, event: 'invoke', finishReason, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
          return gateway.close();
        },
      });
      // Harness が逐次返している途中の失敗
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          onError: (error) => {
            console.error(error);
            return failed();
          },
        }),
      );
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export const handler = streamHandle(app);

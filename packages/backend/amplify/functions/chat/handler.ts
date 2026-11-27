import { env } from '$amplify/env/chat';
import { ApplyGuardrailCommand, BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import type { MCPClient } from '@ai-sdk/mcp';
import { streamHandle } from '@hono/aws-lambda';
import { isSpecType } from '@modelcontextprotocol/client';
import { listAppUrls } from '@workops/domain/apps';
import { createDatabase } from '@workops/domain/database';
import { closeToolRequests, listToolApprovals, recordToolDecisions, recordToolRequests, recordToolResult } from '@workops/domain/tool-approvals';
import { chatSchema } from '@workops/schema/chat';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateId,
  isTextUIPart,
  isToolUIPart,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type ToolSet,
  type UIMessage,
} from 'ai';
import type { APIGatewayProxyWithCognitoAuthorizerEvent } from 'aws-lambda';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';
import { connectGateway, exchangeToken, listGatewayTools } from './gateway';
import { createHarnessModel } from './harness';
import { listConversations, listEvents, pendingToolUses, sessionId, toMessages, toUIMessages } from './memory';

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
};

// 構造化ログです。会話の本文とトークンは出しません。
const log = (entry: object) => console.log(JSON.stringify(entry));

// チャットのAPIです。画面とは AI SDK の UI Message Stream Protocol でやり取りし、回答を逐次返します。
// 書込みのツールは、AI SDK のツールの承認（確認カード）で利用者が承認してから実行します。
const app = new Hono<{ Bindings: { event: APIGatewayProxyWithCognitoAuthorizerEvent }; Variables: { sub: string; userToken: string } }>();

app.use(cors({ origin: async (origin) => ((await allowedOrigins).has(origin) ? origin : null), exposeHeaders: ['x-vercel-ai-ui-message-stream'] }));

// 利用者のトークンだけを受け付けます。マシン間の認可のトークンには principal_type が入りません。
app.use(async (c, next) => {
  const { sub, principal_type: principalType } = c.env.event.requestContext.authorizer.claims;
  const userToken = c.req.header('authorization')?.replace(/^Bearer /i, '');
  if (principalType !== 'user' || userToken === undefined) {
    return c.json({ message: messages.forbidden }, 403);
  }
  c.set('sub', sub);
  c.set('userToken', userToken);
  await next();
});

app.onError((error, c) => {
  console.error(error);
  return c.json({ message: messages.failed }, 500);
});

app.get('/conversations', async (c) => c.json({ conversations: await listConversations(c.get('sub')) }));

// 会話の履歴です。ツールの名前を表示名にするため、利用者として Gateway のツールの一覧を取ります。
app.get('/conversations/:conversationId', async (c) => {
  const gateway = await connectGateway(await exchangeToken(c.get('userToken')));
  try {
    const { tools } = await listGatewayTools(gateway);
    const metadata = new Map(Object.entries(tools).flatMap(([name, tool]) => (tool.metadata === undefined ? [] : [[name, tool.metadata]])));
    const sub = c.get('sub');
    const conversationId = c.req.param('conversationId');
    const approvals = await listToolApprovals(db, sub, conversationId);
    // 取り消したカードと、判断せずに次の依頼をしたカードは、実行していない状態で表示します。
    const denied = new Set(approvals.flatMap((approval) => (approval.status === 'denied' || approval.status === 'abandoned' ? [approval.toolUseId] : [])));
    return c.json({ messages: toUIMessages(toMessages(await listEvents(sub, conversationId)), metadata, denied) });
  } finally {
    await gateway.close();
  }
});

// 会話のIDと最後のメッセージを受け取ります。メッセージの形は AI SDK で検証します。
app.post(
  '/chat',
  validator('json', (value, c) => {
    const parsed = chatSchema.safeParse(value);
    return parsed.success ? parsed.data : c.json({ message: messages.invalid }, 400);
  }),
  async (c) => {
    const { id: conversationId, message: body } = c.req.valid('json');
    const validated = await safeValidateUIMessages({ messages: [body] });
    const message = validated.success ? validated.data.at(0) : undefined;
    if (message === undefined) {
      return c.json({ message: messages.invalid }, 400);
    }
    const sub = c.get('sub');

    // 利用者の依頼です。プロンプト攻撃を調べ、止めた依頼は Harness に渡しません。
    if (message.role === 'user') {
      const text = message.parts
        .filter(isTextUIPart)
        .map((part) => part.text)
        .join('\n');
      const guardrail = await bedrock.send(
        new ApplyGuardrailCommand({ guardrailIdentifier: env.GUARDRAIL_ID, guardrailVersion: env.GUARDRAIL_VERSION, source: 'INPUT', outputScope: 'FULL', content: [{ text: { text } }] }),
      );
      if (guardrail.action === 'GUARDRAIL_INTERVENED') {
        const filter = guardrail.assessments?.flatMap((assessment) => assessment.contentPolicy?.filters ?? []).at(0);
        log({ sub, conversationId, event: 'guardrail', guardrail: 'intervened', guardrailAssessment: { filter: filter?.type, confidence: filter?.confidence } });
        return c.json({ message: messages.blocked }, 400);
      }
      // 判断されないままの確認カードがあれば、判断せずに次の依頼をしたものとして記録し、実行していない結果を依頼と一緒に Harness に返します。
      // AI SDK も、判断されないまま次の依頼が来たツールの呼び出しを実行しません。
      const prepared = await prepare(c.get('userToken'));
      const pending = pendingToolUses(toMessages(await listEvents(sub, conversationId)));
      if (pending.length === 0) {
        return converse({ sub, conversationId, ...prepared, message, prompts: [message] });
      }
      await closeToolRequests(
        db,
        sub,
        pending.map((toolUse) => toolUse.toolUseId),
        'abandoned',
      );
      const abandoned: UIMessage = {
        id: generateId(),
        role: 'assistant',
        parts: pending.map((toolUse) => ({
          type: 'dynamic-tool',
          toolCallId: toolUse.toolUseId,
          toolName: toolUse.name,
          input: toolUse.input,
          state: 'output-denied',
          approval: { id: toolUse.toolUseId, approved: false },
        })),
      };
      return converse({ sub, conversationId, ...prepared, message, prompts: [abandoned, message] });
    }

    // 確認カードの判断です。会話履歴の確認待ちのツール呼び出しすべてに対する判断で、期限内のものだけを受け付けます。
    // ツール名と入力は会話履歴のものを使い、判断を記録できた場合だけ実行します。同じ呼び出しへの判断は最初の1回だけ記録できます。
    // 失敗しうる準備は判断の記録より前に済ませ、準備で失敗したときは確認待ちのまま残して、利用者が判断し直せるようにします。
    const events = await listEvents(sub, conversationId);
    const approvals = new Map(message.parts.filter(isToolUIPart).flatMap((part) => (part.state === 'approval-responded' ? [[part.toolCallId, part.approval]] : [])));
    const decisions = pendingToolUses(toMessages(events)).flatMap((toolUse) => {
      const approval = approvals.get(toolUse.toolUseId);
      return approval === undefined ? [] : [{ toolUse, approval }];
    });
    const lastEventAt = events.at(-1)?.eventTimestamp;
    const expired = lastEventAt === undefined || Date.now() - lastEventAt.getTime() > Number(env.HARNESS_IDLE_TIMEOUT) * 1000;
    if (decisions.length === 0 || decisions.length !== approvals.size) {
      return c.json({ message: messages.conflict }, 409);
    }
    if (expired) {
      await closeToolRequests(
        db,
        sub,
        decisions.map(({ toolUse }) => toolUse.toolUseId),
        'expired',
      );
      return c.json({ message: messages.conflict }, 409);
    }
    const prepared = await prepare(c.get('userToken'));
    const recorded = await recordToolDecisions(
      db,
      sub,
      decisions.map(({ toolUse, approval }) => ({ toolUseId: toolUse.toolUseId, status: approval.approved ? 'approved' : 'denied' })),
    );
    if (!recorded) {
      await prepared.gateway.close();
      return c.json({ message: messages.conflict }, 409);
    }
    for (const { toolUse, approval } of decisions) {
      log({ sub, conversationId, event: 'decision', tool: toolUse.name, toolUseId: toolUse.toolUseId, decision: approval.approved ? 'approved' : 'denied' });
    }
    const prompt: UIMessage = {
      id: message.id,
      role: 'assistant',
      parts: decisions.map(({ toolUse, approval }) => ({
        type: 'dynamic-tool',
        toolCallId: toolUse.toolUseId,
        toolName: toolUse.name,
        input: toolUse.input,
        state: 'approval-responded',
        approval,
      })),
    };
    return converse({ sub, conversationId, ...prepared, message, prompts: [prompt] });
  },
);

// Harness を呼ぶ準備です。利用者のトークンを交換し、利用者として Gateway に接続して、呼べるツールを取ります。
async function prepare(userToken: string) {
  const token = await exchangeToken(userToken);
  const gateway = await connectGateway(token);
  try {
    return { token, gateway, ...(await listGatewayTools(gateway)) };
  } catch (error) {
    await gateway.close();
    throw error;
  }
}

// Harness に依頼か判断を渡し、回答を AI SDK の UI Message Stream で返します。
// 承認された書込みのツールは、AI SDK が利用者として Gateway で実行し、結果を判断の記録に残します。
async function converse(input: {
  sub: string;
  conversationId: string;
  message: UIMessage;
  prompts: UIMessage[];
  token: string;
  gateway: MCPClient;
  readTools: string[];
  tools: ToolSet;
}) {
  const { sub, conversationId, token, gateway, readTools, tools } = input;
  const result = streamText({
    model: createHarnessModel({ token, runtimeSessionId: sessionId(sub, conversationId), actorId: sub, readTools }),
    messages: await convertToModelMessages(input.prompts),
    tools,
    // 読み取りのツール（MCP の readOnlyHint が true）は承認なしで、それ以外は利用者の承認を求めます。AI SDK の文書の MCP のツールの承認の例と同じ判定です。
    toolApproval: ({ toolCall }) => (readTools.includes(toolCall.toolName) ? 'not-applicable' : 'user-approval'),
    // 確認カードを表示したことを記録します。
    onStepEnd: ({ content }) =>
      recordToolRequests(
        db,
        sub,
        content.flatMap((part) =>
          part.type === 'tool-approval-request'
            ? [{ toolUseId: part.toolCall.toolCallId, conversationId, toolName: part.toolCall.toolName, input: part.toolCall.input }]
            : [],
        ),
      ),
    onToolExecutionEnd: ({ toolCall, toolOutput }) => {
      const failed = toolOutput.type === 'tool-error' || (isSpecType.CallToolResult(toolOutput.output) && toolOutput.output.isError === true);
      return recordToolResult(db, sub, toolCall.toolCallId, failed ? 'failed' : 'succeeded');
    },
    onEnd: ({ finishReason, usage }) => {
      log({ sub, conversationId, event: 'invoke', finishReason, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
      return gateway.close();
    },
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: [input.message],
      generateMessageId: generateId,
      onError: (error) => {
        console.error(error);
        log({ sub, conversationId, event: 'invoke', error: 'failed' });
        return messages.failed;
      },
    }),
  });
}

export const handler = streamHandle(app);

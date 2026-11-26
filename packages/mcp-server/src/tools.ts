import type { CallToolResult, JSONObject, ServerContext } from '@modelcontextprotocol/server';
import { McpServer } from '@modelcontextprotocol/server';
import { createAssetType } from '@workops/domain/asset-types';
import { createAsset, deleteAsset, getAsset, listAssets, listAssetTypeOptions, updateAsset } from '@workops/domain/assets';
import type { Context } from '@workops/domain/context';
import { BusinessError } from '@workops/domain/errors';
import { getMembership } from '@workops/domain/membership';
import {
  approveRequest,
  createRequest,
  getOperations,
  getRequest,
  listRequests,
  listRequestTypeOptions,
  rejectRequest,
  returnRequest,
  submitRequest,
  updateRequest,
  withdrawRequest,
} from '@workops/domain/requests';
import { assetTypeSchema } from '@workops/schema/asset-types';
import {
  assetConditionsSchema,
  assetDetailSchema,
  assetIdSchema,
  assetListSchema,
  assetSchema,
  assetTypeOptionsSchema,
  assetUpdateSchema,
} from '@workops/schema/assets';
import {
  requestConditionsSchema,
  requestIdSchema,
  requestListSchema,
  requestReasonSchema,
  requestSchema,
  requestTypeOptionsSchema,
  requestUpdateSchema,
  requestWithOperationsSchema,
} from '@workops/schema/requests';
import { cognito, db, userPoolId } from './connections';

// ツールの処理を、呼び出した利用者として実行します。利用者は Gateway のインターセプターが `_meta` に入れた識別子です。
// 対象が見つからない・権限がないときは null が返るため、同じ文言で失敗にします。
// 投げた例外は、SDK がその文言で失敗の結果にします。業務のエラーではない例外は、内容をログだけに出し、決まった文言にします。
// 結果は構造化した値と、その JSON の文字列の両方で返します。ツール結果の検知は文字列の結果を読みます。
async function run<T extends JSONObject>(
  ctx: ServerContext,
  operate: (context: Context) => Promise<T | null>,
): Promise<CallToolResult> {
  const sub = ctx.mcpReq._meta?.['workops/userSub'];
  if (typeof sub !== 'string') {
    throw new BusinessError('利用者を確認できませんでした。');
  }
  try {
    const member = await getMembership(db, sub);
    if (member === null) {
      throw new BusinessError('所属が登録されていないため、操作できません。');
    }
    const result = await operate({ db, cognito, userPoolId, member });
    if (result === null) {
      throw new BusinessError('対象が見つからないか、操作する権限がありません。');
    }
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  } catch (error) {
    if (error instanceof BusinessError) {
      throw error;
    }
    console.error(JSON.stringify({ event: 'toolError', sub, error: String(error) }));
    throw new Error('処理に失敗しました。', { cause: error });
  }
}

// 操作した対象を返します。業務の処理が null を返したときは null のままにします。
async function target<T>(output: T, operated: Promise<true | null>) {
  return (await operated) === null ? null : output;
}

// 業務の処理をAIのツールとして公開する MCP サーバーを作ります。要求ごとに作ります。
export function createServer() {
  const server = new McpServer({ name: 'workops', version: '1.0.0' });
  const read = { readOnlyHint: true, openWorldHint: false };
  const create = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
  const change = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

  server.registerTool(
    'list-assets',
    {
      title: '資産の一覧',
      description: '資産を検索します。全体管理者以外は自部署の資産だけが対象です。1ページは20件で、使わない条件は null にします。',
      inputSchema: assetConditionsSchema,
      outputSchema: assetListSchema,
      annotations: read,
    },
    (args, ctx) => run(ctx, (context) => listAssets(context, args)),
  );

  server.registerTool(
    'get-asset',
    {
      title: '資産の詳細',
      description: '資産の詳細を取得します。全体管理者以外は自部署の資産だけを取得できます。',
      inputSchema: assetIdSchema,
      outputSchema: assetDetailSchema,
      annotations: read,
    },
    (args, ctx) => run(ctx, (context) => getAsset(context, args.assetId)),
  );

  server.registerTool(
    'list-asset-types',
    {
      title: '資産種別の一覧',
      description: '資産の登録・編集で選べる資産種別を取得します。',
      outputSchema: assetTypeOptionsSchema,
      annotations: read,
    },
    (ctx) => run(ctx, async (context) => ({ assetTypes: await listAssetTypeOptions(context) })),
  );

  server.registerTool(
    'create-asset',
    {
      title: '資産の登録',
      description: '資産を登録します。担当者以上が使えます。資産の担当者は、部署の有効な利用者から選びます。',
      inputSchema: assetSchema,
      outputSchema: assetIdSchema,
      annotations: create,
    },
    (args, ctx) =>
      run(ctx, async (context) => {
        const assetId = await createAsset(context, args);
        return assetId === null ? null : { assetId };
      }),
  );

  server.registerTool(
    'update-asset',
    {
      title: '資産の編集',
      description: '資産の内容を更新します。担当者以上が使えます。資産の担当者は、部署の有効な利用者から選びます。',
      inputSchema: assetUpdateSchema,
      outputSchema: assetIdSchema,
      annotations: change,
    },
    (args, ctx) => {
      const { assetId, ...values } = args;
      return run(ctx, (context) => target({ assetId }, updateAsset(context, assetId, values)));
    },
  );

  server.registerTool(
    'delete-asset',
    {
      title: '資産の削除',
      description: '資産を削除します。承認者以上が使えます。削除した資産は元に戻せません。',
      inputSchema: assetIdSchema,
      outputSchema: assetIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, (context) => target({ assetId: args.assetId }, deleteAsset(context, args.assetId))),
  );

  server.registerTool(
    'create-asset-type',
    {
      title: '資産種別の登録',
      description: '資産種別を登録します。承認者以上が使えます。コードは、ほかの資産種別と重複できません。',
      inputSchema: assetTypeSchema,
      outputSchema: assetTypeSchema,
      annotations: create,
    },
    (args, ctx) =>
      run(ctx, async (context) => {
        const created = await createAssetType(context, args);
        if (created === false) {
          throw new BusinessError('このコードはすでに使われています。別のコードを入力してください。');
        }
        return created === null ? null : args;
      }),
  );

  server.registerTool(
    'list-requests',
    {
      title: '申請の一覧',
      description: '申請を検索します。全体管理者以外は自部署の申請だけが対象です。1ページは20件で、使わない条件は null にします。',
      inputSchema: requestConditionsSchema,
      outputSchema: requestListSchema,
      annotations: read,
    },
    (args, ctx) => run(ctx, (context) => listRequests(context, args)),
  );

  server.registerTool(
    'get-request',
    {
      title: '申請の詳細',
      description: '申請の詳細と、利用者がその申請に対してできる操作を取得します。全体管理者以外は自部署の申請だけを取得できます。',
      inputSchema: requestIdSchema,
      outputSchema: requestWithOperationsSchema,
      annotations: read,
    },
    (args, ctx) =>
      run(ctx, async (context) => {
        const found = await getRequest(context, args.requestId);
        return found === null ? null : { ...found, operations: getOperations(context.member, found) };
      }),
  );

  server.registerTool(
    'list-request-types',
    {
      title: '申請種別の一覧',
      description: '申請の作成・編集で選べる、有効な申請種別を取得します。',
      outputSchema: requestTypeOptionsSchema,
      annotations: read,
    },
    (ctx) => run(ctx, async (context) => ({ requestTypes: await listRequestTypeOptions(context, true) })),
  );

  server.registerTool(
    'create-request',
    {
      title: '申請の作成',
      description: '申請を下書きで作成します。担当者以上が使えます。提出は submit-request で行います。',
      inputSchema: requestSchema,
      outputSchema: requestIdSchema,
      annotations: create,
    },
    (args, ctx) => run(ctx, async (context) => ({ requestId: await createRequest(context, args) })),
  );

  server.registerTool(
    'update-request',
    {
      title: '申請の編集',
      description: '申請の内容を更新します。担当者以上が、自分の下書きの申請に対して使えます。',
      inputSchema: requestUpdateSchema,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => {
      const { requestId, ...values } = args;
      return run(ctx, (context) => target({ requestId }, updateRequest(context, requestId, values)));
    },
  );

  server.registerTool(
    'submit-request',
    {
      title: '申請の提出',
      description: '下書きの申請を提出します。担当者以上が、自分の下書きの申請に対して使えます。',
      inputSchema: requestIdSchema,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, (context) => target({ requestId: args.requestId }, submitRequest(context, args.requestId))),
  );

  server.registerTool(
    'withdraw-request',
    {
      title: '申請の取下げ',
      description: '申請を取り下げます。担当者以上が、自分の下書きか提出済みの申請に対して使えます。',
      inputSchema: requestIdSchema,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, (context) => target({ requestId: args.requestId }, withdrawRequest(context, args.requestId))),
  );

  server.registerTool(
    'approve-request',
    {
      title: '申請の承認',
      description: '提出済みの申請を承認します。承認者以上が、自分以外の申請に対して使えます。',
      inputSchema: requestIdSchema,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, (context) => target({ requestId: args.requestId }, approveRequest(context, args.requestId))),
  );

  server.registerTool(
    'reject-request',
    {
      title: '申請の却下',
      description: '提出済みの申請を、理由を付けて却下します。承認者以上が、自分以外の申請に対して使えます。',
      inputSchema: requestReasonSchema,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) =>
      run(ctx, (context) => target({ requestId: args.requestId }, rejectRequest(context, args.requestId, args.reason))),
  );

  server.registerTool(
    'return-request',
    {
      title: '申請の差戻し',
      description: '提出済みの申請を、理由を付けて申請者に差し戻します。承認者以上が、自分以外の申請に対して使えます。',
      inputSchema: requestReasonSchema,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) =>
      run(ctx, (context) => target({ requestId: args.requestId }, returnRequest(context, args.requestId, args.reason))),
  );

  return server;
}

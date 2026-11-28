import type { CallToolResult, JSONObject, ServerContext } from '@modelcontextprotocol/server';
import { McpServer } from '@modelcontextprotocol/server';
import { createAssetType } from '@workops/domain/asset-types';
import { createAsset, deleteAsset, getAsset, listAssets, listAssetTypeOptions, listMembers, updateAsset } from '@workops/domain/assets';
import type { Context } from '@workops/domain/context';
import { listDepartmentOptions } from '@workops/domain/departments';
import { BusinessError, notFoundError } from '@workops/domain/errors';
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
import { assetTypeIdSchema } from '@workops/schema/asset-types';
import {
  assetConditionsSchema,
  assetDetailSchema,
  assetIdSchema,
  assetListSchema,
  assetTypeOptionsSchema,
  departmentOptionsSchema,
  memberConditionsSchema,
  membersSchema,
} from '@workops/schema/assets';
import {
  requestConditionsSchema,
  requestIdSchema,
  requestListSchema,
  requestTypeOptionsSchema,
  requestWithOperationsSchema,
} from '@workops/schema/requests';
import { writeToolCards } from '@workops/schema/tools';
import { db } from './connections';

// ツールの処理を、呼び出した利用者として実行します。利用者は Gateway のインターセプターが `_meta` に入れた識別子です。
// 読み取りで対象が見つからないときは null が返るため、失敗にします。
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
    const result = await operate({ db, member });
    if (result === null) {
      throw notFoundError();
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
      description: '資産の詳細を、部署名・種別名・担当者の名前と一緒に取得します。全体管理者以外は自部署の資産だけを取得できます。',
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
    'list-departments',
    {
      title: '部署の一覧',
      description: '資産の登録で選べる部署を取得します。全体管理者はすべての部署、それ以外は自部署だけです。',
      outputSchema: departmentOptionsSchema,
      annotations: read,
    },
    (ctx) => run(ctx, async (context) => ({ departments: await listDepartmentOptions(context) })),
  );

  server.registerTool(
    'list-members',
    {
      title: '担当者の候補の一覧',
      description: '資産の担当者に選べる、部署の有効な利用者を、名前・メールで検索します。全体管理者はすべての部署、それ以外は自部署の利用者です。依頼に出てきた人の名前で検索し、結果の sub を担当者に指定します。',
      inputSchema: memberConditionsSchema,
      outputSchema: membersSchema,
      annotations: read,
    },
    (args, ctx) => run(ctx, async (context) => ({ members: await listMembers(context, null, args.q) })),
  );

  server.registerTool(
    'create-asset',
    {
      title: '資産の登録',
      description: '資産を登録します。担当者以上が使えます。資産の担当者は、部署の有効な利用者から選びます。',
      inputSchema: writeToolCards['create-asset'].input,
      outputSchema: assetIdSchema,
      annotations: create,
    },
    (args, ctx) => run(ctx, async (context) => ({ assetId: await createAsset(context, args) })),
  );

  server.registerTool(
    'update-asset',
    {
      title: '資産の編集',
      description: '資産の名称・種別・状態・担当者のうち、変える項目だけを渡して更新します。変えない項目は渡しません。担当者以上が使えます。担当者は list-members で探した、資産の部署の有効な利用者の sub を渡し、未割当にするときは null を渡します。',
      inputSchema: writeToolCards['update-asset'].input,
      outputSchema: assetIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, async (context) => ({ assetId: await updateAsset(context, args.assetId, args) })),
  );

  server.registerTool(
    'delete-asset',
    {
      title: '資産の削除',
      description: '資産を削除します。承認者以上が使えます。削除した資産は元に戻せません。',
      inputSchema: writeToolCards['delete-asset'].input,
      outputSchema: assetIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, async (context) => ({ assetId: await deleteAsset(context, args.assetId) })),
  );

  server.registerTool(
    'create-asset-type',
    {
      title: '資産種別の登録',
      description: '資産種別を登録します。承認者以上が使えます。コードは、ほかの資産種別と重複できません。',
      inputSchema: writeToolCards['create-asset-type'].input,
      outputSchema: assetTypeIdSchema,
      annotations: create,
    },
    (args, ctx) => run(ctx, async (context) => ({ assetTypeId: await createAssetType(context, args) })),
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
      description: '申請の詳細と、利用者がその申請に対してできる操作を取得します。全体管理者以外は自部署の申請だけを取得できます。申請を操作する前に、できる操作を確かめます。',
      inputSchema: requestIdSchema,
      outputSchema: requestWithOperationsSchema,
      annotations: read,
    },
    (args, ctx) =>
      run(ctx, async (context) => {
        const found = await getRequest(context, args.requestId);
        // 削除のツールはないため、できる操作から削除を外す
        return found === null ? null : requestWithOperationsSchema.parse({ ...found, operations: getOperations(context.member, found) });
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
      inputSchema: writeToolCards['create-request'].input,
      outputSchema: requestIdSchema,
      annotations: create,
    },
    (args, ctx) => run(ctx, async (context) => ({ requestId: await createRequest(context, args) })),
  );

  server.registerTool(
    'update-request',
    {
      title: '申請の編集',
      description: '申請の件名・説明・種別・金額のうち、変える項目だけを渡して更新します。変えない項目は渡しません。担当者以上が、自分の下書きの申請に対して使えます。',
      inputSchema: writeToolCards['update-request'].input,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, async (context) => ({ requestId: await updateRequest(context, args.requestId, args) })),
  );

  server.registerTool(
    'submit-request',
    {
      title: '申請の提出',
      description: '下書きの申請を提出します。担当者以上が、自分の下書きの申請に対して使えます。',
      inputSchema: writeToolCards['submit-request'].input,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, async (context) => ({ requestId: await submitRequest(context, args.requestId) })),
  );

  server.registerTool(
    'withdraw-request',
    {
      title: '申請の取下げ',
      description: '申請を取り下げます。担当者以上が、自分の下書きか提出済みの申請に対して使えます。',
      inputSchema: writeToolCards['withdraw-request'].input,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, async (context) => ({ requestId: await withdrawRequest(context, args.requestId) })),
  );

  server.registerTool(
    'approve-request',
    {
      title: '申請の承認',
      description: '提出済みの申請を承認します。承認者以上が、自分以外の申請に対して使えます。',
      inputSchema: writeToolCards['approve-request'].input,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, async (context) => ({ requestId: await approveRequest(context, args.requestId) })),
  );

  server.registerTool(
    'reject-request',
    {
      title: '申請の却下',
      description: '提出済みの申請を、理由を付けて却下します。承認者以上が、自分以外の申請に対して使えます。',
      inputSchema: writeToolCards['reject-request'].input,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, async (context) => ({ requestId: await rejectRequest(context, args.requestId, args.reason) })),
  );

  server.registerTool(
    'return-request',
    {
      title: '申請の差戻し',
      description: '提出済みの申請を、理由を付けて申請者に差し戻します。承認者以上が、自分以外の申請に対して使えます。',
      inputSchema: writeToolCards['return-request'].input,
      outputSchema: requestIdSchema,
      annotations: change,
    },
    (args, ctx) => run(ctx, async (context) => ({ requestId: await returnRequest(context, args.requestId, args.reason) })),
  );

  return server;
}

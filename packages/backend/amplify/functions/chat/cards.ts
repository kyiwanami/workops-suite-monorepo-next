import { getAsset, listAssetTypeOptions } from '@workops/domain/assets';
import type { Context } from '@workops/domain/context';
import { listDepartmentOptions } from '@workops/domain/departments';
import { getOperations, getRequest, listRequestTypeOptions } from '@workops/domain/requests';
import { getUser } from '@workops/domain/users';
import { assetIdSchema } from '@workops/schema/assets';
import { requestIdSchema } from '@workops/schema/requests';
import { writeTools } from '@workops/schema/tools';
import type { JSONValue } from 'ai';

// 確認カードの対象の今の値を、関連する名前と一緒に、業務の処理で読みます。画面と業務MCPサーバーと同じ処理のため、利用者の部署の範囲で読みます。
// 対象のない新規作成や、扱えない対象では null を返します。
export async function readTarget(context: Context, toolName: string, input: JSONValue) {
  const target = writeTools.get(toolName)?.target ?? null;
  if (target === null) {
    return null;
  }
  if (target.input === assetIdSchema) {
    const args = assetIdSchema.safeParse(input);
    return args.success ? getAsset(context, args.data.assetId) : null;
  }
  const args = requestIdSchema.safeParse(input);
  if (!args.success) {
    return null;
  }
  const found = await getRequest(context, args.data.requestId);
  return found === null ? null : target.value.parse({ ...found, operations: getOperations(context.member, found) });
}

// 入力の ID の項目の名前を引く処理です。項目名から引きます。
const nameReaders = new Map<string, (context: Context, id: string) => Promise<string | undefined>>([
  ['assetTypeId', async (context, id) => (await listAssetTypeOptions(context)).find((option) => option.id === id)?.name],
  ['departmentId', async (context, id) => (await listDepartmentOptions(context)).find((option) => option.id === id)?.name],
  ['requestTypeId', async (context, id) => (await listRequestTypeOptions(context, false)).find((option) => option.id === id)?.name],
  ['assigneeSub', async (context, id) => (await getUser(context, id))?.name],
]);

// 確認カードの入力の ID の項目のうち、対象の今の値と違う（変えたあとの）項目の名前を引きます。変えない項目の名前は、対象の値にあります。
export async function readNames(context: Context, toolName: string, input: JSONValue, target: Record<string, JSONValue> | null) {
  const parsed = writeTools.get(toolName)?.input.safeParse(input);
  if (parsed === undefined || !parsed.success) {
    return null;
  }
  const names = new Map<string, string>();
  for (const [field, id] of Object.entries(parsed.data)) {
    const read = nameReaders.get(field);
    // 名前を引かない項目、ID が未設定、変えない項目
    if (read === undefined || typeof id !== 'string' || target?.[field] === id) {
      continue;
    }
    const name = await read(context, id);
    // 利用者に見えない・存在しない ID は除く
    if (name !== undefined) {
      names.set(field, name);
    }
  }
  return names.size === 0 ? null : Object.fromEntries(names);
}

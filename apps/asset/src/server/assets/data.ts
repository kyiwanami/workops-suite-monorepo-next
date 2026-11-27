import 'server-only';
import * as assets from '@workops/domain/assets';
import type { AssetChanges, AssetConditions, assetSchema } from '@workops/schema/assets';
import * as departments from '@workops/domain/departments';
import type { z } from 'zod';
import { found } from '@workops/server/found';
import { getContext } from '@/server/user';

// 部署の選択肢です。全体管理者はすべての部署、それ以外は自部署だけを、表示順・部署コードの順で返します。
export async function listDepartmentOptions() {
  return departments.listDepartmentOptions(await getContext());
}

// 資産種別の選択肢です。表示順・コードの順で返します。
export async function listAssetTypeOptions() {
  return assets.listAssetTypeOptions(await getContext());
}

// 部署に所属する有効な利用者です。担当者の選択肢に使います。名前の順で返します。
// 部署を指定しないときは、全体管理者はすべての部署、それ以外は自部署の利用者です。
export async function listMembers(departmentId: string | null) {
  return assets.listMembers(await getContext(), departmentId, null);
}

// 資産の一覧です。検索条件で絞り込み、1ページ分を返します。
export async function listAssets(conditions: AssetConditions) {
  return assets.listAssets(await getContext(), conditions);
}

// 資産の詳細です。扱える部署の資産でなければ、見つからない画面を表示します。
export async function getAsset(id: string) {
  return found(await assets.getAsset(await getContext(), id));
}

// 資産を登録します。
export async function createAsset(values: z.infer<typeof assetSchema>) {
  await assets.createAsset(await getContext(), values);
}

// 資産を更新します。
export async function updateAsset(id: string, values: AssetChanges) {
  await assets.updateAsset(await getContext(), id, values);
}

// 資産を削除します。
export async function deleteAsset(id: string) {
  await assets.deleteAsset(await getContext(), id);
}

import 'server-only';
import * as assets from '@workops/domain/assets';
import type { AssetConditions, assetSchema } from '@workops/schema/assets';
import * as departments from '@workops/domain/departments';
import type { z } from 'zod';
import { found } from '@workops/server/found';
import { getContext } from '@/server/user';

// 部署の選択肢です。表示順・部署コードの順で返します。
export async function listDepartmentOptions() {
  return departments.listDepartmentOptions(await getContext());
}

// 資産種別の選択肢です。表示順・コードの順で返します。
export async function listAssetTypeOptions() {
  return assets.listAssetTypeOptions(await getContext());
}

// 部署に所属する有効な利用者です。担当者の選択肢に使います。名前の順で返します。
export async function listMembers(departmentIds: string[]) {
  return assets.listMembers(await getContext(), departmentIds);
}

// 資産の一覧です。検索条件で絞り込み、1ページ分を返します。
export async function listAssets(conditions: AssetConditions) {
  return assets.listAssets(await getContext(), conditions);
}

// 資産の詳細です。扱える部署の資産でなければ、見つからない画面を表示します。
export async function getAsset(id: string) {
  return found(await assets.getAsset(await getContext(), id));
}

// 資産の一覧の1行の型です。
export type AssetRow = Awaited<ReturnType<typeof listAssets>>['assets'][number];

// 資産の詳細の型です。
export type AssetDetail = Awaited<ReturnType<typeof getAsset>>;

// 部署・資産種別の選択肢の1件の型です。
export type Option = Awaited<ReturnType<typeof listDepartmentOptions>>[number];

// 担当者の選択肢の1件の型です。
export type Member = Awaited<ReturnType<typeof listMembers>>[number];

// 資産を登録します。権限がなければ、見つからない画面を表示します。
export async function createAsset(values: z.infer<typeof assetSchema>) {
  found(await assets.createAsset(await getContext(), values));
}

// 資産を更新します。扱える資産でないか権限がなければ、見つからない画面を表示します。
export async function updateAsset(id: string, values: z.infer<typeof assetSchema>) {
  found(await assets.updateAsset(await getContext(), id, values));
}

// 資産の状態を変えます。変える前と後の状態を返します。扱える資産でないか権限がなければ、見つからない画面を表示します。
export async function changeStatus(id: string, status: AssetDetail['status']) {
  return found(await assets.changeStatus(await getContext(), id, status));
}

// 資産を削除します。扱える資産でないか権限がなければ、見つからない画面を表示します。
export async function deleteAsset(id: string) {
  found(await assets.deleteAsset(await getContext(), id));
}

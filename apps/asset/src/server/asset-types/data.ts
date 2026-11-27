import 'server-only';
import * as assetTypes from '@workops/domain/asset-types';
import type { assetTypeSchema } from '@workops/schema/asset-types';
import { hasRole } from '@workops/domain/membership';
import { notFound } from 'next/navigation';
import type { z } from 'zod';
import { found } from '@workops/server/found';
import { getContext, getMember } from '@/server/user';

// 資産種別の管理は承認者以上だけに許可します。権限がなければ、見つからない画面を表示します。
export async function getManager() {
  const member = await getMember();
  if (!hasRole(member, 'manager')) {
    notFound();
  }
  return member;
}

// 資産種別を表示順・コードの順で全件返します。権限がなければ、見つからない画面を表示します。
export async function listAssetTypes() {
  return found(await assetTypes.listAssetTypes(await getContext()));
}

// 資産種別の一覧の1行の型です。
export type AssetTypeRow = Awaited<ReturnType<typeof listAssetTypes>>[number];

// 資産種別を登録します。コードがすでに使われていたら false を返します。権限がなければ、見つからない画面を表示します。
export async function createAssetType(values: z.infer<typeof assetTypeSchema>) {
  return found(await assetTypes.createAssetType(await getContext(), values));
}

// 資産種別を更新します。権限がなければ、見つからない画面を表示します。
export async function updateAssetType(id: string, values: z.infer<typeof assetTypeSchema>) {
  found(await assetTypes.updateAssetType(await getContext(), id, values));
}

// 資産種別を削除します。権限がなければ、見つからない画面を表示します。
export async function deleteAssetType(id: string) {
  found(await assetTypes.deleteAssetType(await getContext(), id));
}

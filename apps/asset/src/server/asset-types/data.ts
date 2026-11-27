import 'server-only';
import * as assetTypes from '@workops/domain/asset-types';
import type { assetTypeSchema } from '@workops/schema/asset-types';
import { hasRole } from '@workops/domain/membership';
import { notFound } from 'next/navigation';
import type { z } from 'zod';
import { getContext, getMember } from '@/server/user';

// 資産種別の管理は承認者以上だけに許可します。権限がなければ、見つからない画面を表示します。
export async function getManager() {
  const member = await getMember();
  if (!hasRole(member, 'manager')) {
    notFound();
  }
  return member;
}

// 資産種別を表示順・コードの順で全件返します。
export async function listAssetTypes() {
  return assetTypes.listAssetTypes(await getContext());
}

// 資産種別を登録します。
export async function createAssetType(values: z.infer<typeof assetTypeSchema>) {
  await assetTypes.createAssetType(await getContext(), values);
}

// 資産種別を更新します。
export async function updateAssetType(id: string, values: z.infer<typeof assetTypeSchema>) {
  await assetTypes.updateAssetType(await getContext(), id, values);
}

// 資産種別を削除し、削除できたかを返します。
export async function deleteAssetType(id: string) {
  return assetTypes.deleteAssetType(await getContext(), id);
}

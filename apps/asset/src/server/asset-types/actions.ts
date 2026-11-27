'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAssetType, deleteAssetType, updateAssetType } from './data';
import { assetTypeSchema } from '@workops/schema/asset-types';
import { serializeAssetTypeSearchParams } from '@/features/asset-types/search-params';

// 入力を検証して資産種別を登録し、一覧を最新にします。コードがすでに使われていたら false を返します。
export async function createAssetTypeAction(input: z.infer<typeof assetTypeSchema>) {
  const created = await createAssetType(assetTypeSchema.parse(input));
  revalidatePath('/asset-types');
  return created;
}

// 入力を検証して資産種別を更新し、一覧を最新にします。
export async function updateAssetTypeAction(id: string, input: z.infer<typeof assetTypeSchema>) {
  await updateAssetType(z.uuid().parse(id), assetTypeSchema.parse(input));
  revalidatePath('/asset-types');
}

// 資産種別を削除し、削除した旨を出す一覧へ戻ります。資産が残っていて削除できなければ、その旨を返します。
export async function deleteAssetTypeAction(formData: FormData) {
  if (!(await deleteAssetType(String(formData.get('id'))))) {
    return '削除できませんでした。この種別の資産が残っています。';
  }
  revalidatePath('/asset-types');
  redirect(serializeAssetTypeSearchParams('/asset-types', { done: 'deleted' }));
}

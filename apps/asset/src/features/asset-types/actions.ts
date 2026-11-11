'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAssetType, deleteAssetType, updateAssetType } from './data';
import { assetTypeSchema } from './schema';

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

// 資産種別を削除し、一覧を最新にします。
export async function deleteAssetTypeAction(formData: FormData) {
  await deleteAssetType(String(formData.get('id')));
  revalidatePath('/asset-types');
}

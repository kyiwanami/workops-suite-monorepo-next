'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { changeStatus, createAsset, deleteAsset, updateAsset } from './data';
import { assetSchema, assetStatus } from './schema';
import { serializeAssetSearchParams } from './search-params';

// 保存した旨を出す一覧の URL です。
const savedUrl = serializeAssetSearchParams('/assets', { saved: true });

// 入力を検証して資産を登録し、保存した旨を出す一覧へ戻ります。
export async function createAssetAction(input: z.infer<typeof assetSchema>) {
  await createAsset(assetSchema.parse(input));
  revalidatePath('/assets');
  redirect(savedUrl);
}

// 入力を検証して資産を更新し、保存した旨を出す一覧へ戻ります。
export async function updateAssetAction(id: string, input: z.infer<typeof assetSchema>) {
  await updateAsset(z.uuid().parse(id), assetSchema.parse(input));
  revalidatePath('/assets');
  redirect(savedUrl);
}

// 資産の状態を変え、一覧を最新にします。変える前と後の状態を返します。
export async function changeStatusAction(id: string, status: z.infer<typeof assetStatus>) {
  const changed = await changeStatus(z.uuid().parse(id), assetStatus.parse(status));
  revalidatePath('/assets');
  return changed;
}

// 資産を削除し、一覧へ戻ります。
export async function deleteAssetAction(formData: FormData) {
  await deleteAsset(String(formData.get('id')));
  revalidatePath('/assets');
  redirect('/assets');
}

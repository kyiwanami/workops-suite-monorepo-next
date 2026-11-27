'use server';

import { BusinessError } from '@workops/domain/errors';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAsset, deleteAsset, updateAsset } from './data';
import { assetSchema, assetStatus } from '@workops/schema/assets';
import { serializeAssetSearchParams } from '@/features/assets/search-params';

// 保存した旨を出す一覧の URL です。
const savedUrl = serializeAssetSearchParams('/assets', { done: 'saved' });

// 入力を検証して資産を登録し、保存した旨を出す一覧へ戻ります。業務のルールで登録できなければ、その文言を返します。
export async function createAssetAction(input: z.infer<typeof assetSchema>) {
  try {
    await createAsset(assetSchema.parse(input));
  } catch (error) {
    if (error instanceof BusinessError) {
      return error.message;
    }
    throw error;
  }
  revalidatePath('/assets');
  redirect(savedUrl);
}

// 入力を検証して資産を更新し、保存した旨を出す一覧へ戻ります。業務のルールで更新できなければ、その文言を返します。
export async function updateAssetAction(id: string, input: z.infer<typeof assetSchema>) {
  try {
    await updateAsset(z.uuid().parse(id), assetSchema.parse(input));
  } catch (error) {
    if (error instanceof BusinessError) {
      return error.message;
    }
    throw error;
  }
  revalidatePath('/assets');
  redirect(savedUrl);
}

// 資産の状態だけを変え、一覧を最新にします。
export async function changeStatusAction(id: string, status: z.infer<typeof assetStatus>) {
  await updateAsset(z.uuid().parse(id), { status: assetStatus.parse(status) });
  revalidatePath('/assets');
}

// 資産を削除し、削除した旨を出す一覧へ戻ります。業務のルールで削除できなければ、その文言を返します。
export async function deleteAssetAction(formData: FormData) {
  try {
    await deleteAsset(z.uuid().parse(formData.get('id')));
  } catch (error) {
    if (error instanceof BusinessError) {
      return error.message;
    }
    throw error;
  }
  revalidatePath('/assets');
  redirect(serializeAssetSearchParams('/assets', { done: 'deleted' }));
}

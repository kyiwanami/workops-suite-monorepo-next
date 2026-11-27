'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createRequestType, deleteRequestType, updateRequestType } from './data';
import { requestTypeSchema } from '@workops/schema/request-types';
import { serializeRequestTypeSearchParams } from '@/features/request-types/search-params';

// 入力を検証して申請種別を登録し、一覧を最新にします。
export async function createRequestTypeAction(input: z.infer<typeof requestTypeSchema>) {
  await createRequestType(requestTypeSchema.parse(input));
  revalidatePath('/request-types');
}

// 入力を検証して申請種別を更新し、一覧を最新にします。
export async function updateRequestTypeAction(id: string, input: z.infer<typeof requestTypeSchema>) {
  await updateRequestType(z.uuid().parse(id), requestTypeSchema.parse(input));
  revalidatePath('/request-types');
}

// 申請種別を削除し、削除した旨を出す一覧へ戻ります。申請が使っていて削除できなければ、その旨を返します。
export async function deleteRequestTypeAction(formData: FormData) {
  if (!(await deleteRequestType(z.uuid().parse(formData.get('id'))))) {
    return '削除できませんでした。この種別を使っている申請が残っています。';
  }
  revalidatePath('/request-types');
  redirect(serializeRequestTypeSearchParams('/request-types', { done: 'deleted' }));
}

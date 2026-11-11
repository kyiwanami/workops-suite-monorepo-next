'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createRequestType, deleteRequestType, updateRequestType } from './data';
import { requestTypeSchema } from './schema';

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

// 申請種別を削除し、一覧を最新にします。
export async function deleteRequestTypeAction(formData: FormData) {
  await deleteRequestType(z.uuid().parse(formData.get('id')));
  revalidatePath('/request-types');
}

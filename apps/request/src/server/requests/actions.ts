'use server';

import { BusinessError } from '@workops/domain/errors';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  approveRequest,
  createRequest,
  deleteRequest,
  rejectRequest,
  returnRequest,
  submitRequest,
  updateRequest,
  withdrawRequest,
} from './data';
import { reasonSchema, requestSchema } from '@workops/schema/requests';
import { serializeRequestDetailSearchParams, serializeRequestSearchParams } from '@/features/requests/search-params';

// 申請を操作し、一覧と詳細を最新にして、操作した旨を出す一覧へ戻ります。
// 申請の今の状態で操作できなければ、詳細へ戻して最新の状態と、操作できなかった旨を出します。
async function operate<T>(id: string, run: (id: string) => Promise<T>, done: 'submitted' | 'withdrawn' | 'deleted' | 'approved' | 'rejected' | 'returned') {
  try {
    await run(id);
  } catch (error) {
    if (error instanceof BusinessError) {
      revalidatePath('/requests', 'layout');
      redirect(serializeRequestDetailSearchParams(`/requests/${id}`, { failed: true }));
    }
    throw error;
  }
  revalidatePath('/requests', 'layout');
  redirect(serializeRequestSearchParams('/requests', { done }));
}

// 入力を検証して申請を下書きで作成し、作った申請の ID を返します。提出は続けて submitRequestAction で行います。
// 業務のルールで作成できなければ、その文言を返します。
export async function createRequestAction(input: z.infer<typeof requestSchema>) {
  try {
    const id = await createRequest(requestSchema.parse(input));
    revalidatePath('/requests', 'layout');
    return { id };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { message: error.message };
    }
    throw error;
  }
}

// 入力を検証して本人の下書きを保存し、申請の ID を返します。提出は続けて submitRequestAction で行います。
// 業務のルールで保存できなければ、その文言を返します。
export async function updateRequestAction(id: string, input: z.infer<typeof requestSchema>) {
  try {
    await updateRequest(z.uuid().parse(id), requestSchema.parse(input));
    revalidatePath('/requests', 'layout');
    return { id };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { message: error.message };
    }
    throw error;
  }
}

// 本人の下書きを提出します。
export async function submitRequestAction(id: string) {
  await operate(z.uuid().parse(id), submitRequest, 'submitted');
}

// 本人の申請を取り下げます。
export async function withdrawRequestAction(formData: FormData) {
  await operate(z.uuid().parse(formData.get('id')), withdrawRequest, 'withdrawn');
}

// 本人の下書きを削除します。
export async function deleteRequestAction(formData: FormData) {
  await operate(z.uuid().parse(formData.get('id')), deleteRequest, 'deleted');
}

// 他者の提出済みの申請を承認します。
export async function approveRequestAction(formData: FormData) {
  await operate(z.uuid().parse(formData.get('id')), approveRequest, 'approved');
}

// 理由を検証して、他者の提出済みの申請を却下します。
export async function rejectRequestAction(id: string, input: z.infer<typeof reasonSchema>) {
  const { reason } = reasonSchema.parse(input);
  await operate(z.uuid().parse(id), (requestId) => rejectRequest(requestId, reason), 'rejected');
}

// 理由を検証して、他者の提出済みの申請を差し戻します。
export async function returnRequestAction(id: string, input: z.infer<typeof reasonSchema>) {
  const { reason } = reasonSchema.parse(input);
  await operate(z.uuid().parse(id), (requestId) => returnRequest(requestId, reason), 'returned');
}

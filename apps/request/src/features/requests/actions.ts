'use server';

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
import { reasonSchema, requestSchema } from './schema';
import { serializeRequestSearchParams } from './search-params';

// 保存した旨を出す一覧の URL です。
const savedUrl = serializeRequestSearchParams('/requests', { saved: true });

// 申請を変えたあと、一覧と詳細を最新にして、保存した旨を出す一覧へ戻ります。
function done(): never {
  revalidatePath('/requests', 'layout');
  redirect(savedUrl);
}

// 入力を検証して申請を下書きで作成し、作った申請の ID を返します。提出は続けて submitRequestAction で行います。
export async function createRequestAction(input: z.infer<typeof requestSchema>) {
  const id = await createRequest(requestSchema.parse(input));
  revalidatePath('/requests', 'layout');
  return id;
}

// 入力を検証して本人の下書きを保存し、申請の ID を返します。提出は続けて submitRequestAction で行います。
export async function updateRequestAction(id: string, input: z.infer<typeof requestSchema>) {
  await updateRequest(z.uuid().parse(id), requestSchema.parse(input));
  revalidatePath('/requests', 'layout');
  return id;
}

// 本人の下書きを提出します。
export async function submitRequestAction(id: string) {
  await submitRequest(z.uuid().parse(id));
  done();
}

// 本人の申請を取り下げます。
export async function withdrawRequestAction(formData: FormData) {
  await withdrawRequest(z.uuid().parse(formData.get('id')));
  done();
}

// 本人の下書きを削除します。
export async function deleteRequestAction(formData: FormData) {
  await deleteRequest(z.uuid().parse(formData.get('id')));
  done();
}

// 他者の提出済みの申請を承認します。
export async function approveRequestAction(formData: FormData) {
  await approveRequest(z.uuid().parse(formData.get('id')));
  done();
}

// 理由を検証して、他者の提出済みの申請を却下します。
export async function rejectRequestAction(id: string, input: z.infer<typeof reasonSchema>) {
  await rejectRequest(z.uuid().parse(id), reasonSchema.parse(input).reason);
  done();
}

// 理由を検証して、他者の提出済みの申請を差し戻します。
export async function returnRequestAction(id: string, input: z.infer<typeof reasonSchema>) {
  await returnRequest(z.uuid().parse(id), reasonSchema.parse(input).reason);
  done();
}

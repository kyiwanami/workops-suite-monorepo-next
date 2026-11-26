import 'server-only';
import * as departments from '@workops/domain/departments';
import * as requests from '@workops/domain/requests';
import type { RequestConditions, requestSchema } from '@workops/schema/requests';
import type { z } from 'zod';
import { found, getContext } from '@/server/context';

// 部署の選択肢です。表示順・部署コードの順で返します。
export async function listDepartmentOptions() {
  return departments.listDepartmentOptions(await getContext());
}

// 申請種別の選択肢です。表示順・コードの順で返します。作成・編集では有効な種別だけを選べます。
export async function listRequestTypeOptions(activeOnly: boolean) {
  return requests.listRequestTypeOptions(await getContext(), activeOnly);
}

// 申請の一覧です。検索条件で絞り込み、1ページ分を返します。
export async function listRequests(conditions: RequestConditions) {
  return requests.listRequests(await getContext(), conditions);
}

// 申請の詳細です。扱える部署の申請でなければ、見つからない画面を表示します。
export async function getRequest(id: string) {
  return found(await requests.getRequest(await getContext(), id));
}

// 申請の一覧の1行の型です。
export type RequestRow = Awaited<ReturnType<typeof listRequests>>['requests'][number];

// 申請の詳細の型です。
export type RequestDetail = Awaited<ReturnType<typeof getRequest>>;

// 部署・申請種別の選択肢の1件の型です。
export type Option = Awaited<ReturnType<typeof listDepartmentOptions>>[number];

// 申請を下書きで作成し、作った申請の ID を返します。
export async function createRequest(values: z.infer<typeof requestSchema>) {
  return requests.createRequest(await getContext(), values);
}

// 本人の下書きを編集します。扱える申請でなければ、見つからない画面を表示します。
export async function updateRequest(id: string, values: z.infer<typeof requestSchema>) {
  found(await requests.updateRequest(await getContext(), id, values));
}

// 本人の下書きを提出します。
export async function submitRequest(id: string) {
  found(await requests.submitRequest(await getContext(), id));
}

// 本人の下書き・提出済みの申請を取り下げます。
export async function withdrawRequest(id: string) {
  found(await requests.withdrawRequest(await getContext(), id));
}

// 本人の下書きを削除します。
export async function deleteRequest(id: string) {
  found(await requests.deleteRequest(await getContext(), id));
}

// 他者の提出済みの申請を承認します。
export async function approveRequest(id: string) {
  found(await requests.approveRequest(await getContext(), id));
}

// 他者の提出済みの申請を却下し、理由を残します。
export async function rejectRequest(id: string, reason: string) {
  found(await requests.rejectRequest(await getContext(), id, reason));
}

// 他者の提出済みの申請を差し戻し、理由を残します。
export async function returnRequest(id: string, reason: string) {
  found(await requests.returnRequest(await getContext(), id, reason));
}

import 'server-only';
import { hasRole } from '@workops/domain/membership';
import * as requestTypes from '@workops/domain/request-types';
import type { requestTypeSchema } from '@workops/schema/request-types';
import { notFound } from 'next/navigation';
import type { z } from 'zod';
import { found } from '@workops/server/found';
import { getContext, getMember } from '@/server/user';

// 申請種別の管理は承認者以上だけに許可します。権限がなければ、見つからない画面を表示します。
export async function getManager() {
  const member = await getMember();
  if (!hasRole(member, 'manager')) {
    notFound();
  }
  return member;
}

// 申請種別を表示順・コードの順で全件返します。権限がなければ、見つからない画面を表示します。
export async function listRequestTypes() {
  return found(await requestTypes.listRequestTypes(await getContext()));
}

// 申請種別の一覧の1行の型です。
export type RequestTypeRow = Awaited<ReturnType<typeof listRequestTypes>>[number];

// 申請種別を登録します。権限がなければ、見つからない画面を表示します。
export async function createRequestType(values: z.infer<typeof requestTypeSchema>) {
  found(await requestTypes.createRequestType(await getContext(), values));
}

// 申請種別を更新します。権限がなければ、見つからない画面を表示します。
export async function updateRequestType(id: string, values: z.infer<typeof requestTypeSchema>) {
  found(await requestTypes.updateRequestType(await getContext(), id, values));
}

// 申請種別を削除します。権限がなければ、見つからない画面を表示します。
export async function deleteRequestType(id: string) {
  found(await requestTypes.deleteRequestType(await getContext(), id));
}

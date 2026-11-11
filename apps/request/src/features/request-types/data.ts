import 'server-only';
import { request, requestType } from '@workops/blocks/schema';
import { db } from '@workops/server/db';
import { hasRole } from '@workops/server/user';
import { asc, count, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import type { z } from 'zod';
import { getMember } from '@/user';
import type { requestTypeSchema } from './schema';

// 申請種別の管理は承認者以上だけに許可します。権限がなければ、見つからない画面を表示します。
export async function getManager() {
  const member = await getMember();
  if (!hasRole(member, 'manager')) {
    notFound();
  }
  return member;
}

// 申請種別を表示順・コードの順で全件返します。その種別を使っている申請の件数を一緒に返します。
export async function listRequestTypes() {
  await getManager();
  return db
    .select({
      id: requestType.id,
      code: requestType.code,
      name: requestType.name,
      description: requestType.description,
      isActive: requestType.isActive,
      sortOrder: requestType.sortOrder,
      requestCount: count(request.id),
    })
    .from(requestType)
    .leftJoin(request, eq(request.requestTypeId, requestType.id))
    .groupBy(requestType.id)
    .orderBy(asc(requestType.sortOrder), asc(requestType.code));
}

// 申請種別の一覧の1行の型です。
export type RequestTypeRow = Awaited<ReturnType<typeof listRequestTypes>>[number];

// 申請種別の保存する値です。説明は空なら未設定にします。
const columns = (values: z.infer<typeof requestTypeSchema>) => ({
  code: values.code,
  name: values.name,
  description: values.description || null,
  sortOrder: values.sortOrder,
});

// 申請種別を登録します。新しい種別は有効です。作成者・更新者はログイン中の利用者です。
export async function createRequestType(values: z.infer<typeof requestTypeSchema>) {
  const manager = await getManager();
  const now = new Date().toISOString();
  await db
    .insert(requestType)
    .values({ ...columns(values), createdAt: now, createdBy: manager.sub, updatedAt: now, updatedBy: manager.sub });
}

// 申請種別を更新します。コードも変えられます。
export async function updateRequestType(id: string, values: z.infer<typeof requestTypeSchema>) {
  const manager = await getManager();
  await db
    .update(requestType)
    .set({ ...columns(values), updatedAt: new Date().toISOString(), updatedBy: manager.sub })
    .where(eq(requestType.id, id));
}

// 申請種別を削除します。申請が使っている種別は、DB の参照制約で削除できません。
export async function deleteRequestType(id: string) {
  await getManager();
  await db.delete(requestType).where(eq(requestType.id, id));
}

import { request, requestType } from '@workops/blocks/schema';
import { and, asc, count, eq, notExists } from 'drizzle-orm';
import type { z } from 'zod';
import type { Context } from './context';
import { hasRole } from './membership';
import type { requestTypeSchema } from '@workops/schema/request-types';

// 申請種別を表示順・コードの順で全件返します。その種別を使っている申請の件数を一緒に返します。承認者以上でなければ null を返します。
export async function listRequestTypes(context: Context) {
  if (!hasRole(context.member, 'manager')) {
    return null;
  }
  return context.db
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

// 申請種別の保存する値です。説明は空なら未設定にします。
const columns = (values: z.infer<typeof requestTypeSchema>) => ({
  code: values.code,
  name: values.name,
  description: values.description || null,
  sortOrder: values.sortOrder,
});

// 申請種別を登録し、登録した申請種別の ID を返します。新しい種別は有効です。作成者・更新者は操作する利用者です。
// 承認者以上でなければ null を返します。
export async function createRequestType(context: Context, values: z.infer<typeof requestTypeSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'manager')) {
    return null;
  }
  const now = new Date().toISOString();
  const created = await db
    .insert(requestType)
    .values({ ...columns(values), createdAt: now, createdBy: member.sub, updatedAt: now, updatedBy: member.sub })
    .returning({ id: requestType.id });
  return created[0].id;
}

// 申請種別を更新し、true を返します。コードも変えられます。承認者以上でなければ null を返します。
export async function updateRequestType(context: Context, id: string, values: z.infer<typeof requestTypeSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'manager')) {
    return null;
  }
  await db
    .update(requestType)
    .set({ ...columns(values), updatedAt: new Date().toISOString(), updatedBy: member.sub })
    .where(eq(requestType.id, id));
  return true;
}

// 申請が使っていない申請種別を削除し、削除できたかを返します。承認者以上でなければ null を返します。
export async function deleteRequestType(context: Context, id: string) {
  if (!hasRole(context.member, 'manager')) {
    return null;
  }
  const { db } = context;
  const deleted = await db
    .delete(requestType)
    .where(and(eq(requestType.id, id), notExists(db.select().from(request).where(eq(request.requestTypeId, id)))))
    .returning({ id: requestType.id });
  return deleted.length > 0;
}

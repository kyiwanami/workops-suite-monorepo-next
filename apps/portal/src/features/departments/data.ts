import 'server-only';
import { db } from '@workops/server/db';
import { department, userMembership } from '@workops/blocks/schema';
import { asc, count, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { getAdmin } from '@/user';
import type { departmentSchema } from './schema';

// 部署を表示順・部署コードの順で全件返します。所属人数を一緒に返します。
export async function listDepartments() {
  await getAdmin();
  return db
    .select({
      id: department.id,
      code: department.code,
      name: department.name,
      sortOrder: department.sortOrder,
      notes: department.notes,
      memberCount: count(userMembership.sub),
    })
    .from(department)
    .leftJoin(userMembership, eq(userMembership.departmentId, department.id))
    .groupBy(department.id)
    .orderBy(asc(department.sortOrder), asc(department.code));
}

// 部署の保存する値です。表示順は数にし、備考は空なら未設定にします。
const columns = (values: z.infer<typeof departmentSchema>) => ({
  code: values.code,
  name: values.name,
  sortOrder: Number(values.sortOrder),
  notes: values.notes || null,
});

// 部署を登録します。作成者・更新者はログイン中の利用者です。
export async function createDepartment(values: z.infer<typeof departmentSchema>) {
  const admin = await getAdmin();
  const now = new Date().toISOString();
  await db
    .insert(department)
    .values({ ...columns(values), createdAt: now, createdBy: admin.sub, updatedAt: now, updatedBy: admin.sub });
}

// 部署を更新します。更新者はログイン中の利用者です。
export async function updateDepartment(values: z.infer<typeof departmentSchema>) {
  const admin = await getAdmin();
  await db
    .update(department)
    .set({ ...columns(values), updatedAt: new Date().toISOString(), updatedBy: admin.sub })
    .where(eq(department.id, values.id));
}

// 部署を削除します。
export async function deleteDepartment(id: string) {
  await getAdmin();
  await db.delete(department).where(eq(department.id, id));
}

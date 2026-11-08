import 'server-only';
import { db } from '@workops/server/db';
import { getMembership } from '@/user';
import { department } from '@workops/blocks/schema';
import { asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';

// 部署の管理は全体管理者だけに許可します。権限がなければ、見つからない画面を表示します。
async function getAdmin() {
  const membership = await getMembership();
  if (membership === null || !membership.isAdmin) {
    notFound();
  }
  return membership;
}

// 部署を表示順・部署コードの順で全件返します。
export async function listDepartments() {
  await getAdmin();
  return db
    .select({
      id: department.id,
      code: department.code,
      name: department.name,
      sortOrder: department.sortOrder,
      notes: department.notes,
    })
    .from(department)
    .orderBy(asc(department.sortOrder), asc(department.code));
}

// 部署を登録します。作成者・更新者はログイン中の利用者です。
export async function createDepartment(input: {
  code: string;
  name: string;
  sortOrder: number;
  notes: string | null;
}) {
  const admin = await getAdmin();
  const now = new Date().toISOString();
  await db.insert(department).values({
    ...input,
    createdAt: now,
    createdBy: admin.sub,
    updatedAt: now,
    updatedBy: admin.sub,
  });
}

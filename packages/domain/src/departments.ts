import { department } from '@workops/blocks/schema';
import { asc, eq } from 'drizzle-orm';
import type { Context } from './context';
import type { DepartmentOption } from '@workops/schema/assets';

// 部署の選択肢です。全体管理者はすべての部署、それ以外は自部署だけを、表示順・部署コードの順で返します。
export async function listDepartmentOptions(context: Context): Promise<DepartmentOption[]> {
  const { db, member } = context;
  return db
    .select({ id: department.id, name: department.name })
    .from(department)
    .where(member.isAdmin ? undefined : eq(department.id, member.departmentId))
    .orderBy(asc(department.sortOrder), asc(department.code));
}

import { department } from '@workops/blocks/schema';
import { asc } from 'drizzle-orm';
import type { Context } from './context';

// 部署の選択肢です。表示順・部署コードの順で返します。
export async function listDepartmentOptions(context: Context) {
  return context.db
    .select({ id: department.id, name: department.name })
    .from(department)
    .orderBy(asc(department.sortOrder), asc(department.code));
}

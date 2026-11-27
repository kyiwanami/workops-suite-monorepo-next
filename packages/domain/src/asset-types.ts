import { asset, assetType } from '@workops/blocks/schema';
import { and, asc, count, eq, notExists } from 'drizzle-orm';
import type { z } from 'zod';
import type { Context } from './context';
import { hasRole } from './membership';
import type { assetTypeSchema } from '@workops/schema/asset-types';

// 資産種別を表示順・コードの順で全件返します。その種別の資産の件数を一緒に返します。承認者以上でなければ null を返します。
export async function listAssetTypes(context: Context) {
  if (!hasRole(context.member, 'manager')) {
    return null;
  }
  return context.db
    .select({
      id: assetType.id,
      code: assetType.code,
      name: assetType.name,
      description: assetType.description,
      sortOrder: assetType.sortOrder,
      assetCount: count(asset.id),
    })
    .from(assetType)
    .leftJoin(asset, eq(asset.assetTypeId, assetType.id))
    .groupBy(assetType.id)
    .orderBy(asc(assetType.sortOrder), asc(assetType.code));
}

// 資産種別の保存する値です。説明は空なら未設定にします。
const columns = (values: z.infer<typeof assetTypeSchema>) => ({
  name: values.name,
  description: values.description || null,
  sortOrder: values.sortOrder,
});

// 資産種別を登録します。作成者・更新者は操作する利用者です。
// 登録したら true、コードがすでに使われていたら false、承認者以上でなければ null を返します。
export async function createAssetType(context: Context, values: z.infer<typeof assetTypeSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'manager')) {
    return null;
  }
  const now = new Date().toISOString();
  const created = await db
    .insert(assetType)
    .values({ code: values.code, ...columns(values), createdAt: now, createdBy: member.sub, updatedAt: now, updatedBy: member.sub })
    .onConflictDoNothing()
    .returning({ id: assetType.id });
  return created.length > 0;
}

// 資産種別を更新し、true を返します。コードは変えません。承認者以上でなければ null を返します。
export async function updateAssetType(context: Context, id: string, values: z.infer<typeof assetTypeSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'manager')) {
    return null;
  }
  await db
    .update(assetType)
    .set({ ...columns(values), updatedAt: new Date().toISOString(), updatedBy: member.sub })
    .where(eq(assetType.id, id));
  return true;
}

// 資産のない資産種別を削除し、削除できたかを返します。承認者以上でなければ null を返します。
export async function deleteAssetType(context: Context, id: string) {
  if (!hasRole(context.member, 'manager')) {
    return null;
  }
  const { db } = context;
  const deleted = await db
    .delete(assetType)
    .where(and(eq(assetType.id, id), notExists(db.select().from(asset).where(eq(asset.assetTypeId, id)))))
    .returning({ id: assetType.id });
  return deleted.length > 0;
}

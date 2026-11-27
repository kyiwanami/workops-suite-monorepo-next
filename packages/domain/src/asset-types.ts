import { asset, assetType } from '@workops/blocks/schema';
import { and, asc, count, eq, notExists } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-orm/zod';
import { z } from 'zod';
import type { Context } from './context';
import { BusinessError, roleError } from './errors';
import { hasRole } from './membership';
import type { assetTypeSchema } from '@workops/schema/asset-types';

// 資産種別の一覧の1件です。DB の資産種別の列と、その種別の資産の件数です。
export const assetTypeRowSchema = createSelectSchema(assetType)
  .pick({ id: true, code: true, name: true, description: true, sortOrder: true })
  .extend({ assetCount: z.number() });
export type AssetTypeRow = z.infer<typeof assetTypeRowSchema>;

// 資産種別を表示順・コードの順で全件返します。その種別の資産の件数を一緒に返します。承認者以上が使えます。
export async function listAssetTypes(context: Context): Promise<AssetTypeRow[]> {
  if (!hasRole(context.member, 'manager')) {
    throw roleError();
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

// 資産種別を登録し、登録した資産種別の ID を返します。承認者以上が使えます。作成者・更新者は操作する利用者です。
export async function createAssetType(context: Context, values: z.infer<typeof assetTypeSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'manager')) {
    throw roleError();
  }
  const now = new Date().toISOString();
  const created = await db
    .insert(assetType)
    .values({ code: values.code, ...columns(values), createdAt: now, createdBy: member.sub, updatedAt: now, updatedBy: member.sub })
    .onConflictDoNothing()
    .returning({ id: assetType.id });
  const row = created.at(0);
  if (row === undefined) {
    throw new BusinessError('このコードはすでに使われています。別のコードを入力してください。');
  }
  return row.id;
}

// 資産種別を更新します。コードは変えません。承認者以上が使えます。
export async function updateAssetType(context: Context, id: string, values: z.infer<typeof assetTypeSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'manager')) {
    throw roleError();
  }
  await db
    .update(assetType)
    .set({ ...columns(values), updatedAt: new Date().toISOString(), updatedBy: member.sub })
    .where(eq(assetType.id, id));
}

// 資産のない資産種別を削除し、削除できたかを返します。承認者以上が使えます。
export async function deleteAssetType(context: Context, id: string) {
  if (!hasRole(context.member, 'manager')) {
    throw roleError();
  }
  const { db } = context;
  const deleted = await db
    .delete(assetType)
    .where(and(eq(assetType.id, id), notExists(db.select().from(asset).where(eq(asset.assetTypeId, id)))))
    .returning({ id: assetType.id });
  return deleted.length > 0;
}

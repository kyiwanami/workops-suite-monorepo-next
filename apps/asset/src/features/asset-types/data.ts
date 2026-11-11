import 'server-only';
import { asset, assetType } from '@workops/blocks/schema';
import { db } from '@workops/server/db';
import { hasRole } from '@workops/server/user';
import { asc, count, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import type { z } from 'zod';
import { getMember } from '@/user';
import type { assetTypeSchema } from './schema';

// 資産種別の管理は承認者以上だけに許可します。権限がなければ、見つからない画面を表示します。
export async function getManager() {
  const member = await getMember();
  if (!hasRole(member, 'manager')) {
    notFound();
  }
  return member;
}

// 資産種別を表示順・コードの順で全件返します。その種別の資産の件数を一緒に返します。
export async function listAssetTypes() {
  await getManager();
  return db
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

// 資産種別の一覧の1行の型です。
export type AssetTypeRow = Awaited<ReturnType<typeof listAssetTypes>>[number];

// 資産種別の保存する値です。説明は空なら未設定にします。
const columns = (values: z.infer<typeof assetTypeSchema>) => ({
  name: values.name,
  description: values.description || null,
  sortOrder: values.sortOrder,
});

// 資産種別を登録します。作成者・更新者はログイン中の利用者です。コードがすでに使われていたら false を返します。
export async function createAssetType(values: z.infer<typeof assetTypeSchema>) {
  const manager = await getManager();
  const now = new Date().toISOString();
  const created = await db
    .insert(assetType)
    .values({ code: values.code, ...columns(values), createdAt: now, createdBy: manager.sub, updatedAt: now, updatedBy: manager.sub })
    .onConflictDoNothing()
    .returning({ id: assetType.id });
  return created.length > 0;
}

// 資産種別を更新します。コードは変えません。
export async function updateAssetType(id: string, values: z.infer<typeof assetTypeSchema>) {
  const manager = await getManager();
  await db
    .update(assetType)
    .set({ ...columns(values), updatedAt: new Date().toISOString(), updatedBy: manager.sub })
    .where(eq(assetType.id, id));
}

// 資産種別を削除します。
export async function deleteAssetType(id: string) {
  await getManager();
  await db.delete(assetType).where(eq(assetType.id, id));
}

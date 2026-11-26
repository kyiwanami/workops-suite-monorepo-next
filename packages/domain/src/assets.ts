import { asset, assetType, department, userMembership } from '@workops/blocks/schema';
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Context } from './context';
import { BusinessError } from './errors';
import { hasRole, type Membership } from './membership';
import { listUsers } from './users';
import type { AssetConditions, assetSchema } from '@workops/schema/assets';

// 一覧の1ページの件数です。
export const pageSize = 20;

// 利用者が扱える資産の条件です。全体管理者はすべての部署、それ以外は自部署の資産だけを扱えます。
const departmentScope = (member: Membership) => (member.isAdmin ? undefined : eq(asset.departmentId, member.departmentId));

// 資産種別の選択肢です。表示順・コードの順で返します。
export async function listAssetTypeOptions(context: Context) {
  return context.db
    .select({ id: assetType.id, name: assetType.name })
    .from(assetType)
    .orderBy(asc(assetType.sortOrder), asc(assetType.code));
}

// 部署に所属する有効な利用者です。担当者の選択肢に使います。名前の順で返します。
export async function listMembers(context: Context, departmentIds: string[]) {
  const [users, memberships] = await Promise.all([
    listUsers(context),
    context.db
      .select({ sub: userMembership.sub, departmentId: userMembership.departmentId })
      .from(userMembership)
      .where(inArray(userMembership.departmentId, departmentIds)),
  ]);
  const usersBySub = new Map(users.filter((user) => user.enabled).map((user) => [user.sub, user]));
  return memberships
    .flatMap((membership) => {
      const user = usersBySub.get(membership.sub);
      return user === undefined ? [] : [{ sub: user.sub, name: user.name, email: user.email, departmentId: membership.departmentId }];
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

// 資産の一覧です。名称または担当者の名前・メールの部分一致・状態・種別・部署で絞り込み、更新日時の新しい順で1ページ分を返します。
// 部署の絞り込みは全体管理者だけに効きます。種別名・部署名・担当者の名前を一緒に返します。
export async function listAssets(context: Context, conditions: AssetConditions) {
  const { db, member } = context;
  const users = await listUsers(context);
  const keyword = conditions.q?.toLowerCase();
  // 検索語に名前・メールが当てはまる利用者です。
  const matchedSubs =
    keyword === undefined
      ? []
      : users.filter((user) => user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword)).map((user) => user.sub);
  const where = and(
    departmentScope(member),
    member.isAdmin && conditions.department !== null ? eq(asset.departmentId, conditions.department) : undefined,
    conditions.q === null
      ? undefined
      : or(ilike(asset.name, `%${conditions.q}%`), matchedSubs.length > 0 ? inArray(asset.assigneeSub, matchedSubs) : undefined),
    conditions.status === null ? undefined : eq(asset.status, conditions.status),
    conditions.type === null ? undefined : eq(asset.assetTypeId, conditions.type),
  );
  const start = (conditions.page - 1) * pageSize;
  const [counts, rows] = await Promise.all([
    db.select({ total: count() }).from(asset).where(where),
    db
      .select({
        id: asset.id,
        name: asset.name,
        status: asset.status,
        assigneeSub: asset.assigneeSub,
        updatedAt: asset.updatedAt,
        assetTypeName: assetType.name,
        departmentName: department.name,
      })
      .from(asset)
      .innerJoin(assetType, eq(assetType.id, asset.assetTypeId))
      .innerJoin(department, eq(department.id, asset.departmentId))
      .where(where)
      .orderBy(desc(asset.updatedAt))
      .limit(pageSize)
      .offset(start),
  ]);
  const namesBySub = new Map(users.map((user) => [user.sub, user.name]));
  return {
    total: counts[0].total,
    start,
    assets: rows.map((row) => ({ ...row, assigneeName: row.assigneeSub === null ? null : (namesBySub.get(row.assigneeSub) ?? null) })),
  };
}

// 資産の詳細です。扱える部署の資産でなければ null を返します。種別名と担当者の名前を一緒に返します。
export async function getAsset(context: Context, id: string) {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }
  const rows = await context.db
    .select({
      id: asset.id,
      departmentId: asset.departmentId,
      name: asset.name,
      assetTypeId: asset.assetTypeId,
      assetTypeName: assetType.name,
      status: asset.status,
      assigneeSub: asset.assigneeSub,
      updatedAt: asset.updatedAt,
    })
    .from(asset)
    .innerJoin(assetType, eq(assetType.id, asset.assetTypeId))
    .where(and(eq(asset.id, id), departmentScope(context.member)));
  const row = rows.at(0);
  if (row === undefined) {
    return null;
  }
  const assignee = row.assigneeSub === null ? undefined : (await listUsers(context)).find((user) => user.sub === row.assigneeSub);
  return { ...row, assigneeName: assignee?.name ?? null };
}

// 担当者が、部署の有効な利用者か未割当であることを確かめます。
async function checkAssignee(context: Context, departmentId: string, assigneeSub: string | null) {
  if (assigneeSub === null) {
    return;
  }
  const members = await listMembers(context, [departmentId]);
  if (!members.some((member) => member.sub === assigneeSub)) {
    throw new BusinessError('担当者は、部署の有効な利用者から選んでください。');
  }
}

// 資産を登録し、登録した資産の ID を返します。担当者以上でなければ null を返します。
// 全体管理者は選んだ部署、それ以外は自部署に登録します。作成者・更新者は操作する利用者です。
export async function createAsset(context: Context, values: z.infer<typeof assetSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'editor')) {
    return null;
  }
  const departmentId = member.isAdmin ? values.departmentId : member.departmentId;
  await checkAssignee(context, departmentId, values.assigneeSub);
  const now = new Date().toISOString();
  const created = await db
    .insert(asset)
    .values({
      departmentId,
      name: values.name,
      assetTypeId: values.assetTypeId,
      status: values.status,
      assigneeSub: values.assigneeSub,
      createdAt: now,
      createdBy: member.sub,
      updatedAt: now,
      updatedBy: member.sub,
    })
    .returning({ id: asset.id });
  return created[0].id;
}

// 資産を更新し、true を返します。部署は変えません。担当者以上でないか、扱える資産でなければ null を返します。
export async function updateAsset(context: Context, id: string, values: z.infer<typeof assetSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'editor')) {
    return null;
  }
  const current = await getAsset(context, id);
  if (current === null) {
    return null;
  }
  await checkAssignee(context, current.departmentId, values.assigneeSub);
  await db
    .update(asset)
    .set({
      name: values.name,
      assetTypeId: values.assetTypeId,
      status: values.status,
      assigneeSub: values.assigneeSub,
      updatedAt: new Date().toISOString(),
      updatedBy: member.sub,
    })
    .where(eq(asset.id, current.id));
  return true;
}

// 資産の状態を変えます。変える前と後の状態を返します。担当者以上でないか、扱える資産でなければ null を返します。
export async function changeStatus(context: Context, id: string, status: typeof asset.$inferSelect['status']) {
  const { db, member } = context;
  if (!hasRole(member, 'editor')) {
    return null;
  }
  const current = await getAsset(context, id);
  if (current === null) {
    return null;
  }
  await db
    .update(asset)
    .set({ status, updatedAt: new Date().toISOString(), updatedBy: member.sub })
    .where(eq(asset.id, current.id));
  return { from: current.status, to: status };
}

// 資産を削除し、true を返します。承認者以上でないか、扱える資産でなければ null を返します。
export async function deleteAsset(context: Context, id: string) {
  if (!hasRole(context.member, 'manager')) {
    return null;
  }
  const current = await getAsset(context, id);
  if (current === null) {
    return null;
  }
  await context.db.delete(asset).where(eq(asset.id, current.id));
  return true;
}

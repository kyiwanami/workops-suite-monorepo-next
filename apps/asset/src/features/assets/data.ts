import 'server-only';
import { asset, assetType, department, userMembership } from '@workops/blocks/schema';
import { attribute, listCognitoUsers, requiredAttribute } from '@workops/server/cognito';
import { db } from '@workops/server/db';
import { hasRole } from '@workops/server/user';
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getMember } from '@/user';
import type { assetSchema } from './schema';
import type { AssetSearchParams } from './search-params';

// 一覧の1ページの件数です。
export const pageSize = 20;

// 利用者が扱える資産の条件です。全体管理者はすべての部署、それ以外は自部署の資産だけを扱えます。
const departmentScope = (member: Awaited<ReturnType<typeof getMember>>) =>
  member.isAdmin ? undefined : eq(asset.departmentId, member.departmentId);

// 操作に必要なロールを確かめます。満たさなければ、見つからない画面を表示します。
async function getMemberWithRole(role: typeof userMembership.$inferSelect['role']) {
  const member = await getMember();
  if (!hasRole(member, role)) {
    notFound();
  }
  return member;
}

// Cognito の利用者を、利用者識別子・名前（未設定ならメール）・メール・有効区分の形で返します。
async function listUsers() {
  const users = await listCognitoUsers();
  return users.map((user) => {
    const email = requiredAttribute(user.Attributes, 'email');
    return {
      sub: requiredAttribute(user.Attributes, 'sub'),
      name: attribute(user.Attributes, 'name') ?? email,
      email,
      enabled: user.Enabled === true,
    };
  });
}

// 部署の選択肢です。表示順・部署コードの順で返します。
export async function listDepartmentOptions() {
  await getMember();
  return db
    .select({ id: department.id, name: department.name })
    .from(department)
    .orderBy(asc(department.sortOrder), asc(department.code));
}

// 資産種別の選択肢です。表示順・コードの順で返します。
export async function listAssetTypeOptions() {
  await getMember();
  return db
    .select({ id: assetType.id, name: assetType.name })
    .from(assetType)
    .orderBy(asc(assetType.sortOrder), asc(assetType.code));
}

// 部署に所属する有効な利用者です。担当者の選択肢に使います。名前の順で返します。
export async function listMembers(departmentIds: string[]) {
  await getMember();
  const [users, memberships] = await Promise.all([
    listUsers(),
    db
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
export async function listAssets(conditions: AssetSearchParams) {
  const member = await getMember();
  const users = await listUsers();
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

// 資産の詳細です。扱える部署の資産でなければ、見つからない画面を表示します。種別名と担当者の名前を一緒に返します。
export async function getAsset(id: string) {
  const member = await getMember();
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }
  const rows = await db
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
    .where(and(eq(asset.id, id), departmentScope(member)));
  const row = rows.at(0);
  if (row === undefined) {
    notFound();
  }
  const assignee = row.assigneeSub === null ? undefined : (await listUsers()).find((user) => user.sub === row.assigneeSub);
  return { ...row, assigneeName: assignee?.name ?? null };
}

// 資産の一覧の1行の型です。
export type AssetRow = Awaited<ReturnType<typeof listAssets>>['assets'][number];

// 資産の詳細の型です。
export type AssetDetail = Awaited<ReturnType<typeof getAsset>>;

// 部署・資産種別の選択肢の1件の型です。
export type Option = Awaited<ReturnType<typeof listDepartmentOptions>>[number];

// 担当者の選択肢の1件の型です。
export type Member = Awaited<ReturnType<typeof listMembers>>[number];

// 担当者が、部署の有効な利用者か未割当であることを確かめます。
async function checkAssignee(departmentId: string, assigneeSub: string | null) {
  if (assigneeSub === null) {
    return;
  }
  const members = await listMembers([departmentId]);
  if (!members.some((member) => member.sub === assigneeSub)) {
    throw new Error('担当者は、部署の有効な利用者から選んでください。');
  }
}

// 資産を登録します。全体管理者は選んだ部署、それ以外は自部署に登録します。作成者・更新者はログイン中の利用者です。
export async function createAsset(values: z.infer<typeof assetSchema>) {
  const member = await getMemberWithRole('editor');
  const departmentId = member.isAdmin ? values.departmentId : member.departmentId;
  await checkAssignee(departmentId, values.assigneeSub);
  const now = new Date().toISOString();
  await db.insert(asset).values({
    departmentId,
    name: values.name,
    assetTypeId: values.assetTypeId,
    status: values.status,
    assigneeSub: values.assigneeSub,
    createdAt: now,
    createdBy: member.sub,
    updatedAt: now,
    updatedBy: member.sub,
  });
}

// 資産を更新します。部署は変えません。
export async function updateAsset(id: string, values: z.infer<typeof assetSchema>) {
  const member = await getMemberWithRole('editor');
  const current = await getAsset(id);
  await checkAssignee(current.departmentId, values.assigneeSub);
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
}

// 資産の状態を変えます。変える前と後の状態を返します。
export async function changeStatus(id: string, status: typeof asset.$inferSelect['status']) {
  const member = await getMemberWithRole('editor');
  const current = await getAsset(id);
  await db
    .update(asset)
    .set({ status, updatedAt: new Date().toISOString(), updatedBy: member.sub })
    .where(eq(asset.id, current.id));
  return { from: current.status, to: status };
}

// 資産を削除します。
export async function deleteAsset(id: string) {
  await getMemberWithRole('manager');
  const current = await getAsset(id);
  await db.delete(asset).where(eq(asset.id, current.id));
}

import { asset, assetType, department, userMembership } from '@workops/blocks/schema';
import { and, asc, count, desc, eq, exists, ilike, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Context } from './context';
import { BusinessError, notFoundError, roleError } from './errors';
import { hasRole, type Membership } from './membership';
import { getUser, listUsers } from './users';
import type { AssetChanges, AssetConditions, AssetDetail, AssetList, assetSchema, AssetTypeOption } from '@workops/schema/assets';

// 一覧の1ページの件数です。
const pageSize = 20;

// 利用者が扱える資産の条件です。全体管理者はすべての部署、それ以外は自部署の資産だけを扱えます。
const departmentScope = (member: Membership) => (member.isAdmin ? undefined : eq(asset.departmentId, member.departmentId));

// 資産種別の選択肢です。表示順・コードの順で返します。
export async function listAssetTypeOptions(context: Context): Promise<AssetTypeOption[]> {
  return context.db
    .select({ id: assetType.id, name: assetType.name })
    .from(assetType)
    .orderBy(asc(assetType.sortOrder), asc(assetType.code));
}

// 部署に所属する有効な利用者です。担当者の選択肢に使います。名前の順で返します。
// 部署を指定しないときは、全体管理者はすべての部署、それ以外は自部署の利用者です。扱えない部署を指定したときは空です。
// 検索語があれば、名前・メールの部分一致で絞り込みます。
export async function listMembers(context: Context, departmentId: string | null, q: string | null) {
  const { db, member } = context;
  const [users, memberships] = await Promise.all([
    listUsers(context),
    db
      .select({ sub: userMembership.sub, departmentId: userMembership.departmentId })
      .from(userMembership)
      .where(
        and(
          member.isAdmin ? undefined : eq(userMembership.departmentId, member.departmentId),
          departmentId === null ? undefined : eq(userMembership.departmentId, departmentId),
        ),
      ),
  ]);
  const keyword = q?.toLowerCase();
  const usersBySub = new Map(
    users
      .filter((user) => user.enabled && (keyword === undefined || user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword)))
      .map((user) => [user.sub, user]),
  );
  return memberships
    .flatMap((membership) => {
      const user = usersBySub.get(membership.sub);
      return user === undefined ? [] : [{ sub: user.sub, name: user.name, email: user.email, departmentId: membership.departmentId }];
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

// 資産の一覧です。名称または担当者の名前・メールの部分一致・状態・種別・部署で絞り込み、更新日時の新しい順で1ページ分を返します。
// 部署の絞り込みは全体管理者だけに効きます。種別名・部署名・担当者の名前を一緒に返します。
export async function listAssets(context: Context, conditions: AssetConditions): Promise<AssetList> {
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
  // 1 より前のページは1ページ目として扱う
  const start = (Math.max(conditions.page, 1) - 1) * pageSize;
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

// 資産の詳細です。扱える部署の資産でなければ null を返します。部署名・種別名・担当者の名前を一緒に返します。
export async function getAsset(context: Context, id: string): Promise<AssetDetail | null> {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }
  const rows = await context.db
    .select({
      id: asset.id,
      departmentId: asset.departmentId,
      departmentName: department.name,
      name: asset.name,
      assetTypeId: asset.assetTypeId,
      assetTypeName: assetType.name,
      status: asset.status,
      assigneeSub: asset.assigneeSub,
      updatedAt: asset.updatedAt,
    })
    .from(asset)
    .innerJoin(assetType, eq(assetType.id, asset.assetTypeId))
    .innerJoin(department, eq(department.id, asset.departmentId))
    .where(and(eq(asset.id, id), departmentScope(context.member)));
  const row = rows.at(0);
  if (row === undefined) {
    return null;
  }
  const assignee = row.assigneeSub === null ? null : await getUser(context, row.assigneeSub);
  return { ...row, assigneeName: assignee?.name ?? null };
}

// 担当者の決まり（資産-05）に合わないときのエラーです。
const assigneeError = () => new BusinessError('担当者は、資産の部署の有効な利用者から選んでください。');

// 担当者が有効な利用者であることを確かめます。有効区分は Cognito にあります。
async function checkEnabled(context: Context, sub: string) {
  const user = await getUser(context, sub);
  if (user === null || !user.enabled) {
    throw assigneeError();
  }
}

// 担当者が、更新する資産の部署に所属していることの条件です。
const belongsToAssetDepartment = (context: Context, sub: string) =>
  exists(
    context.db
      .select({ sub: userMembership.sub })
      .from(userMembership)
      .where(and(eq(userMembership.sub, sub), eq(userMembership.departmentId, asset.departmentId))),
  );

// 資産を登録し、登録した資産の ID を返します。担当者以上が使えます。
// 全体管理者は選んだ部署、それ以外は自部署に登録します。担当者は、その部署の有効な利用者か未割当です。作成者・更新者は操作する利用者です。
export async function createAsset(context: Context, values: z.infer<typeof assetSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'editor')) {
    throw roleError();
  }
  const departmentId = member.isAdmin ? values.departmentId : member.departmentId;
  if (values.assigneeSub !== null) {
    await checkEnabled(context, values.assigneeSub);
    const memberships = await db
      .select({ sub: userMembership.sub })
      .from(userMembership)
      .where(and(eq(userMembership.sub, values.assigneeSub), eq(userMembership.departmentId, departmentId)));
    if (memberships.length === 0) {
      throw assigneeError();
    }
  }
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

// 資産の渡した項目だけを変え、資産の ID を返します。部署は変えません。担当者以上が、扱える部署の資産に使えます。
// 担当者を替えるときは、資産の部署の有効な利用者か未割当です。
export async function updateAsset(context: Context, id: string, values: AssetChanges) {
  const { db, member } = context;
  if (!hasRole(member, 'editor')) {
    throw roleError();
  }
  const assigneeSub = values.assigneeSub;
  if (assigneeSub !== undefined && assigneeSub !== null) {
    await checkEnabled(context, assigneeSub);
  }
  const updated = await db
    .update(asset)
    .set({
      name: values.name,
      assetTypeId: values.assetTypeId,
      status: values.status,
      assigneeSub,
      updatedAt: new Date().toISOString(),
      updatedBy: member.sub,
    })
    .where(
      and(
        eq(asset.id, id),
        departmentScope(member),
        assigneeSub === undefined || assigneeSub === null ? undefined : belongsToAssetDepartment(context, assigneeSub),
      ),
    )
    .returning({ id: asset.id });
  const row = updated.at(0);
  if (row === undefined) {
    throw new BusinessError('資産が見つからないか、担当者が資産の部署の利用者ではありません。');
  }
  return row.id;
}

// 資産を削除し、資産の ID を返します。承認者以上が、扱える部署の資産に使えます。
export async function deleteAsset(context: Context, id: string) {
  if (!hasRole(context.member, 'manager')) {
    throw roleError();
  }
  const deleted = await context.db
    .delete(asset)
    .where(and(eq(asset.id, id), departmentScope(context.member)))
    .returning({ id: asset.id });
  const row = deleted.at(0);
  if (row === undefined) {
    throw notFoundError();
  }
  return row.id;
}

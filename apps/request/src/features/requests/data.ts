import 'server-only';
import { auditLog, department, request, requestType } from '@workops/blocks/schema';
import { attribute, listCognitoUsers, requiredAttribute } from '@workops/server/cognito';
import { db } from '@workops/server/db';
import { hasRole } from '@workops/server/user';
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, ne, or, type SQL } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getMember } from '@/user';
import type { requestSchema } from './schema';
import type { RequestSearchParams } from './search-params';

// 一覧の1ページの件数です。
export const pageSize = 20;

// 申請の状態です。
type Status = typeof request.$inferSelect['status'];

// 申請の操作が失敗したときの誤りです。画面では、保存済みの申請を確認するよう案内します。
const operationError = () => new Error('申請を操作できませんでした。');

// 利用者が扱える申請の条件です。全体管理者はすべての部署、それ以外は自部署の申請だけを扱えます。
const departmentScope = (member: Awaited<ReturnType<typeof getMember>>) =>
  member.isAdmin ? undefined : eq(request.departmentId, member.departmentId);

// 日本時間の月の初めの日時です。offset は今月から数えた月の数です。
function monthStart(offset: number) {
  const offsetHours = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + offsetHours);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1) - offsetHours).toISOString();
}

// 期間の条件です。作成日時が今月・先月の範囲にある申請に絞ります。
function periodCondition(period: RequestSearchParams['period']) {
  if (period === 'thisMonth') {
    return gte(request.createdAt, monthStart(0));
  }
  if (period === 'lastMonth') {
    return and(gte(request.createdAt, monthStart(-1)), lt(request.createdAt, monthStart(0)));
  }
  return undefined;
}

// Cognito の利用者を、利用者識別子・名前（未設定ならメール）・メールの形で返します。
async function listUsers() {
  const users = await listCognitoUsers();
  return users.map((user) => {
    const email = requiredAttribute(user.Attributes, 'email');
    return { sub: requiredAttribute(user.Attributes, 'sub'), name: attribute(user.Attributes, 'name') ?? email, email };
  });
}

// 利用者の名前を引く表です。
async function userNames() {
  return new Map((await listUsers()).map((user) => [user.sub, user.name]));
}

// 部署の選択肢です。表示順・部署コードの順で返します。
export async function listDepartmentOptions() {
  await getMember();
  return db
    .select({ id: department.id, name: department.name })
    .from(department)
    .orderBy(asc(department.sortOrder), asc(department.code));
}

// 申請種別の選択肢です。表示順・コードの順で返します。作成・編集では有効な種別だけを選べます。
export async function listRequestTypeOptions(activeOnly: boolean) {
  await getMember();
  return db
    .select({ id: requestType.id, name: requestType.name })
    .from(requestType)
    .where(activeOnly ? eq(requestType.isActive, true) : undefined)
    .orderBy(asc(requestType.sortOrder), asc(requestType.code));
}

// 申請の一覧です。タブ・件名または申請者の名前・メールの部分一致・種別・期間・部署で絞り込み、1ページ分を返します。
// 「自分が承認するもの」は承認者以上だけが使え、提出日時の古い順に並べます。それ以外は更新日時の新しい順です。
// 部署の絞り込みは全体管理者だけに効きます。3つのタブの件数と、承認のタブを使えるかと、種別名・部署名・申請者の名前を一緒に返します。
export async function listRequests(conditions: RequestSearchParams) {
  const member = await getMember();
  const names = await userNames();
  const keyword = conditions.q?.toLowerCase();
  // 検索語に名前・メールが当てはまる利用者です。
  const matchedSubs =
    keyword === undefined
      ? []
      : (await listUsers())
          .filter((user) => user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword))
          .map((user) => user.sub);
  const filters = and(
    departmentScope(member),
    member.isAdmin && conditions.department !== null ? eq(request.departmentId, conditions.department) : undefined,
    conditions.q === null
      ? undefined
      : or(ilike(request.title, `%${conditions.q}%`), matchedSubs.length > 0 ? inArray(request.requesterSub, matchedSubs) : undefined),
    conditions.type === null ? undefined : eq(request.requestTypeId, conditions.type),
    periodCondition(conditions.period),
  );
  const canApprove = hasRole(member, 'manager');
  const tab = conditions.tab === 'approve' && !canApprove ? 'all' : conditions.tab;
  const tabConditions: Record<typeof tab, SQL | undefined> = {
    all: undefined,
    approve: and(eq(request.status, 'submitted'), ne(request.requesterSub, member.sub)),
    mine: eq(request.requesterSub, member.sub),
  };
  // 条件に合う申請の件数です。
  const total = async (where: SQL | undefined) => (await db.select({ total: count() }).from(request).where(where))[0].total;
  const start = (conditions.page - 1) * pageSize;
  const [all, approve, mine, rows] = await Promise.all([
    total(filters),
    canApprove ? total(and(filters, tabConditions.approve)) : 0,
    total(and(filters, tabConditions.mine)),
    db
      .select({
        id: request.id,
        title: request.title,
        status: request.status,
        amount: request.amount,
        requesterSub: request.requesterSub,
        submittedAt: request.submittedAt,
        requestTypeName: requestType.name,
        departmentName: department.name,
      })
      .from(request)
      .innerJoin(requestType, eq(requestType.id, request.requestTypeId))
      .innerJoin(department, eq(department.id, request.departmentId))
      .where(and(filters, tabConditions[tab]))
      .orderBy(tab === 'approve' ? asc(request.submittedAt) : desc(request.updatedAt))
      .limit(pageSize)
      .offset(start),
  ]);
  const counts = { all, approve, mine };
  return {
    tab,
    canApprove,
    counts,
    total: counts[tab],
    start,
    requests: rows.map((row) => ({ ...row, requesterName: names.get(row.requesterSub) ?? null })),
  };
}

// 申請の詳細です。扱える部署の申請でなければ、見つからない画面を表示します。種別名・部署名・申請者の名前を一緒に返します。
export async function getRequest(id: string) {
  const member = await getMember();
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }
  const rows = await db
    .select({ request, requestTypeName: requestType.name, departmentName: department.name })
    .from(request)
    .innerJoin(requestType, eq(requestType.id, request.requestTypeId))
    .innerJoin(department, eq(department.id, request.departmentId))
    .where(and(eq(request.id, id), departmentScope(member)));
  const row = rows.at(0);
  if (row === undefined) {
    notFound();
  }
  const names = await userNames();
  return {
    ...row.request,
    requestTypeName: row.requestTypeName,
    departmentName: row.departmentName,
    requesterName: names.get(row.request.requesterSub) ?? null,
  };
}

// 申請の一覧の1行の型です。
export type RequestRow = Awaited<ReturnType<typeof listRequests>>['requests'][number];

// 申請の詳細の型です。
export type RequestDetail = Awaited<ReturnType<typeof getRequest>>;

// 部署・申請種別の選択肢の1件の型です。
export type Option = Awaited<ReturnType<typeof listDepartmentOptions>>[number];

// 利用者が申請にできる操作です。状態遷移表・ロール・本人条件で決まり、全体管理者にも本人条件と自己承認の禁止を適用します。
export function getOperations(
  member: Awaited<ReturnType<typeof getMember>>,
  target: { requesterSub: string; status: Status },
) {
  const own = target.requesterSub === member.sub;
  const editor = hasRole(member, 'editor');
  const approver = hasRole(member, 'manager') && !own && target.status === 'submitted';
  return {
    update: editor && own && target.status === 'draft',
    submit: editor && own && target.status === 'draft',
    withdraw: editor && own && (target.status === 'draft' || target.status === 'submitted'),
    delete: own && target.status === 'draft',
    approve: approver,
    reject: approver,
    return: approver,
  };
}

// 申請にできる操作の型です。
export type Operations = ReturnType<typeof getOperations>;

// 申請種別が存在して有効であることを確かめます。
async function checkRequestType(id: string) {
  const rows = await db
    .select({ id: requestType.id })
    .from(requestType)
    .where(and(eq(requestType.id, id), eq(requestType.isActive, true)));
  if (rows.length === 0) {
    throw new Error('有効な申請種別を選んでください。');
  }
}

// 申請を操作し、監査ログを同じトランザクションで追記します。操作の可否を確かめ、今の状態のままの申請だけを変えます。
// 操作後の状態が null のときは、申請を削除します。
async function operate(
  id: string,
  operation: keyof Operations,
  newStatus: Status | null,
  values: (now: string) => PgUpdateSetSource<typeof request>,
  reason: string | null,
) {
  const member = await getMember();
  const current = await getRequest(id);
  if (!getOperations(member, current)[operation]) {
    throw operationError();
  }
  const now = new Date().toISOString();
  const target = and(eq(request.id, current.id), eq(request.status, current.status));
  await db.transaction(async (tx) => {
    const changed =
      newStatus === null
        ? await tx.delete(request).where(target).returning({ id: request.id })
        : await tx
            .update(request)
            .set({ ...values(now), status: newStatus, updatedAt: now, updatedBy: member.sub })
            .where(target)
            .returning({ id: request.id });
    if (changed.length === 0) {
      throw operationError();
    }
    await tx.insert(auditLog).values({
      requestId: current.id,
      action: operation,
      previousStatus: current.status,
      newStatus,
      reason,
      createdAt: now,
      createdBy: member.sub,
    });
  });
}

// 申請の保存する値です。説明は空なら未設定にします。
const columns = (values: z.infer<typeof requestSchema>) => ({
  requestTypeId: values.requestTypeId,
  title: values.title,
  description: values.description || null,
  amount: values.amount,
});

// 申請を下書きで作成し、作った申請の ID を返します。部署は申請者の所属部署です。
export async function createRequest(values: z.infer<typeof requestSchema>) {
  const member = await getMember();
  if (!hasRole(member, 'editor')) {
    throw operationError();
  }
  await checkRequestType(values.requestTypeId);
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const created = await tx
      .insert(request)
      .values({
        ...columns(values),
        departmentId: member.departmentId,
        requesterSub: member.sub,
        status: 'draft',
        createdAt: now,
        createdBy: member.sub,
        updatedAt: now,
        updatedBy: member.sub,
      })
      .returning({ id: request.id });
    const id = created[0].id;
    await tx
      .insert(auditLog)
      .values({ requestId: id, action: 'create', previousStatus: null, newStatus: 'draft', reason: null, createdAt: now, createdBy: member.sub });
    return id;
  });
}

// 本人の下書きを編集します。
export async function updateRequest(id: string, values: z.infer<typeof requestSchema>) {
  await checkRequestType(values.requestTypeId);
  await operate(id, 'update', 'draft', () => columns(values), null);
}

// 本人の下書きを提出します。
export async function submitRequest(id: string) {
  await operate(id, 'submit', 'submitted', (now) => ({ submittedAt: now }), null);
}

// 本人の下書き・提出済みの申請を取り下げます。
export async function withdrawRequest(id: string) {
  await operate(id, 'withdraw', 'withdrawn', (now) => ({ withdrawnAt: now }), null);
}

// 本人の下書きを削除します。監査ログは申請を削除した後も残ります。
export async function deleteRequest(id: string) {
  await operate(id, 'delete', null, () => ({}), null);
}

// 他者の提出済みの申請を承認します。
export async function approveRequest(id: string) {
  const member = await getMember();
  await operate(id, 'approve', 'approved', (now) => ({ approvedAt: now, approverSub: member.sub }), null);
}

// 他者の提出済みの申請を却下し、理由を残します。
export async function rejectRequest(id: string, reason: string) {
  await operate(id, 'reject', 'rejected', (now) => ({ rejectedAt: now, rejectionReason: reason }), reason);
}

// 他者の提出済みの申請を下書きに差し戻し、理由を残します。申請者は修正して再提出できます。
export async function returnRequest(id: string, reason: string) {
  await operate(id, 'return', 'draft', (now) => ({ returnedAt: now, returnReason: reason }), reason);
}

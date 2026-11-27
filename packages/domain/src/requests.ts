import { auditLog, department, request, requestType } from '@workops/blocks/schema';
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, ne, or, type SQL } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { Context } from './context';
import { BusinessError } from './errors';
import { hasRole, type Membership } from './membership';
import { listUsers } from './users';
import type {
  RequestConditions,
  RequestDetail,
  RequestList,
  RequestOperations,
  requestSchema,
  RequestTypeOption,
} from '@workops/schema/requests';

// 一覧の1ページの件数です。
export const pageSize = 20;

// 申請の状態です。
type Status = typeof request.$inferSelect['status'];

// 申請の今の状態やロールでは操作できないときのエラーです。
const operationError = () => new BusinessError('申請の今の状態では、この操作はできません。');

// 利用者が扱える申請の条件です。全体管理者はすべての部署、それ以外は自部署の申請だけを扱えます。
const departmentScope = (member: Membership) => (member.isAdmin ? undefined : eq(request.departmentId, member.departmentId));

// 日本時間の月の初めの日時です。offset は今月から数えた月の数です。
function monthStart(offset: number) {
  const offsetHours = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + offsetHours);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1) - offsetHours).toISOString();
}

// 期間の条件です。作成日時が今月・先月の範囲にある申請に絞ります。
function periodCondition(period: RequestConditions['period']) {
  if (period === 'thisMonth') {
    return gte(request.createdAt, monthStart(0));
  }
  if (period === 'lastMonth') {
    return and(gte(request.createdAt, monthStart(-1)), lt(request.createdAt, monthStart(0)));
  }
  return undefined;
}

// 利用者の名前を引く表です。
async function userNames(context: Context) {
  return new Map((await listUsers(context)).map((user) => [user.sub, user.name]));
}

// 申請種別の選択肢です。表示順・コードの順で返します。作成・編集では有効な種別だけを選べます。
export async function listRequestTypeOptions(
  context: Context,
  activeOnly: boolean,
): Promise<RequestTypeOption[]> {
  return context.db
    .select({ id: requestType.id, name: requestType.name })
    .from(requestType)
    .where(activeOnly ? eq(requestType.isActive, true) : undefined)
    .orderBy(asc(requestType.sortOrder), asc(requestType.code));
}

// 申請の一覧です。タブ・件名または申請者の名前・メールの部分一致・種別・期間・部署で絞り込み、1ページ分を返します。
// 「自分が承認するもの」は承認者以上だけが使え、提出日時の古い順に並べます。それ以外は更新日時の新しい順です。
// 部署の絞り込みは全体管理者だけに効きます。3つのタブの件数と、承認のタブを使えるかと、種別名・部署名・申請者の名前を一緒に返します。
export async function listRequests(context: Context, conditions: RequestConditions): Promise<RequestList> {
  const { db, member } = context;
  const users = await listUsers(context);
  const names = new Map(users.map((user) => [user.sub, user.name]));
  const keyword = conditions.q?.toLowerCase();
  // 検索語に名前・メールが当てはまる利用者です。
  const matchedSubs =
    keyword === undefined
      ? []
      : users.filter((user) => user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword)).map((user) => user.sub);
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

// 申請の詳細です。扱える部署の申請でなければ null を返します。種別名・部署名・申請者の名前を一緒に返します。
export async function getRequest(context: Context, id: string): Promise<RequestDetail | null> {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }
  const rows = await context.db
    .select({
      id: request.id,
      title: request.title,
      description: request.description,
      amount: request.amount,
      status: request.status,
      requestTypeId: request.requestTypeId,
      requestTypeName: requestType.name,
      departmentName: department.name,
      requesterSub: request.requesterSub,
      createdAt: request.createdAt,
      submittedAt: request.submittedAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      rejectionReason: request.rejectionReason,
      withdrawnAt: request.withdrawnAt,
      returnedAt: request.returnedAt,
      returnReason: request.returnReason,
    })
    .from(request)
    .innerJoin(requestType, eq(requestType.id, request.requestTypeId))
    .innerJoin(department, eq(department.id, request.departmentId))
    .where(and(eq(request.id, id), departmentScope(context.member)));
  const row = rows.at(0);
  if (row === undefined) {
    return null;
  }
  const names = await userNames(context);
  return { ...row, requesterName: names.get(row.requesterSub) ?? null };
}

// 利用者が申請にできる操作です。状態遷移表・ロール・本人条件で決まり、全体管理者にも本人条件と自己承認の禁止を適用します。
export function getOperations(member: Membership, target: { requesterSub: string; status: Status }): RequestOperations {
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


// 申請種別が存在して有効であることを確かめます。
async function checkRequestType(context: Context, id: string) {
  const rows = await context.db
    .select({ id: requestType.id })
    .from(requestType)
    .where(and(eq(requestType.id, id), eq(requestType.isActive, true)));
  if (rows.length === 0) {
    throw new BusinessError('有効な申請種別を選んでください。');
  }
}

// 申請を操作し、監査ログを同じトランザクションで追記して、true を返します。扱える申請でなければ null を返します。
// 操作の可否を確かめ、今の状態のままの申請だけを変えます。操作後の状態が null のときは、申請を削除します。
async function operate(
  context: Context,
  id: string,
  operation: keyof RequestOperations,
  newStatus: Status | null,
  values: (now: string) => PgUpdateSetSource<typeof request>,
  reason: string | null,
) {
  const { db, member } = context;
  const current = await getRequest(context, id);
  if (current === null) {
    return null;
  }
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
  return true;
}

// 申請の保存する値です。説明は空なら未設定にします。
const columns = (values: z.infer<typeof requestSchema>) => ({
  requestTypeId: values.requestTypeId,
  title: values.title,
  description: values.description || null,
  amount: values.amount,
});

// 申請を下書きで作成し、作った申請の ID を返します。部署は申請者の所属部署です。
export async function createRequest(context: Context, values: z.infer<typeof requestSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'editor')) {
    throw operationError();
  }
  await checkRequestType(context, values.requestTypeId);
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
export async function updateRequest(context: Context, id: string, values: z.infer<typeof requestSchema>) {
  await checkRequestType(context, values.requestTypeId);
  return operate(context, id, 'update', 'draft', () => columns(values), null);
}

// 本人の下書きを提出します。
export async function submitRequest(context: Context, id: string) {
  return operate(context, id, 'submit', 'submitted', (now) => ({ submittedAt: now }), null);
}

// 本人の下書き・提出済みの申請を取り下げます。
export async function withdrawRequest(context: Context, id: string) {
  return operate(context, id, 'withdraw', 'withdrawn', (now) => ({ withdrawnAt: now }), null);
}

// 本人の下書きを削除します。監査ログは申請を削除した後も残ります。
export async function deleteRequest(context: Context, id: string) {
  return operate(context, id, 'delete', null, () => ({}), null);
}

// 他者の提出済みの申請を承認します。
export async function approveRequest(context: Context, id: string) {
  return operate(context, id, 'approve', 'approved', (now) => ({ approvedAt: now, approverSub: context.member.sub }), null);
}

// 他者の提出済みの申請を却下し、理由を残します。
export async function rejectRequest(context: Context, id: string, reason: string) {
  return operate(context, id, 'reject', 'rejected', (now) => ({ rejectedAt: now, rejectionReason: reason }), reason);
}

// 他者の提出済みの申請を下書きに差し戻し、理由を残します。申請者は修正して再提出できます。
export async function returnRequest(context: Context, id: string, reason: string) {
  return operate(context, id, 'return', 'draft', (now) => ({ returnedAt: now, returnReason: reason }), reason);
}

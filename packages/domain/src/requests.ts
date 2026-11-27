import { auditLog, department, request, requestType } from '@workops/blocks/schema';
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias, type PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { Context } from './context';
import { BusinessError, roleError } from './errors';
import { hasRole, type Membership, type MemberRole } from './membership';
import { getUser, listUsers } from './users';
import type {
  RequestConditions,
  RequestDetail,
  RequestList,
  RequestChanges,
  RequestOperations,
  requestSchema,
  RequestTypeOption,
  RequestStatus,
  RequestPeriod,
} from '@workops/schema/requests';
import { requestTransitions } from '@workops/schema/requests';

// 一覧の1ページの件数です。
const pageSize = 20;

// 申請の今の状態やロールでは操作できないときのエラーです。
const operationError = () => new BusinessError('申請が見つからないか、今の状態ではこの操作はできません。申請の詳細で、できる操作を確かめてください。');

// 利用者が扱える申請の条件です。全体管理者はすべての部署、それ以外は自部署の申請だけを扱えます。
const departmentScope = (member: Membership) => (member.isAdmin ? undefined : eq(request.departmentId, member.departmentId));

// 日本時間の月の初めの日時です。offset は今月から数えた月の数です。
function monthStart(offset: number) {
  const offsetHours = 9 * 60 * 60 * 1000;
  const now = new Date(Date.now() + offsetHours);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1) - offsetHours).toISOString();
}

// 期間の条件です。作成日時が今月・先月の範囲にある申請に絞ります。
function periodCondition(period: RequestPeriod) {
  if (period === 'thisMonth') {
    return gte(request.createdAt, monthStart(0));
  }
  if (period === 'lastMonth') {
    return and(gte(request.createdAt, monthStart(-1)), lt(request.createdAt, monthStart(0)));
  }
  return undefined;
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
  // タブの条件に合う申請の件数です。
  const countWhere = (condition: SQL | undefined) => sql`count(*) filter (where ${condition})`.mapWith(Number);
  // 1 より前のページは1ページ目として扱う
  const start = (Math.max(conditions.page, 1) - 1) * pageSize;
  const [[totals], rows] = await Promise.all([
    db
      .select({ all: count(), approve: countWhere(tabConditions.approve), mine: countWhere(tabConditions.mine) })
      .from(request)
      .where(filters),
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
  // 承認のタブを使えない利用者には、承認するものを数えない
  const counts = { all: totals.all, approve: canApprove ? totals.approve : 0, mine: totals.mine };
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
  const requester = await getUser(context, row.requesterSub);
  return { ...row, requesterName: requester?.name ?? null };
}

// 申請の操作の決まりです。必要なロール（なければ null）、本人の申請だけか（false は他者の申請だけ）、操作できる今の状態です。
// 画面のボタンの出し分けと、操作の実行の条件の両方に使います。全体管理者にも、本人の条件と自己承認の禁止を適用します。
const operationRules: Record<keyof RequestOperations, { role: MemberRole | null; own: boolean; from: RequestStatus[] }> = {
  update: { role: 'editor', own: true, from: ['draft'] },
  submit: { role: 'editor', own: true, from: ['draft'] },
  withdraw: { role: 'editor', own: true, from: ['draft', 'submitted'] },
  delete: { role: null, own: true, from: ['draft'] },
  approve: { role: 'manager', own: false, from: ['submitted'] },
  reject: { role: 'manager', own: false, from: ['submitted'] },
  return: { role: 'manager', own: false, from: ['submitted'] },
};

// 利用者のロールで、その操作をできるかです。
const hasRuleRole = (member: Membership, operation: keyof RequestOperations) => {
  const { role } = operationRules[operation];
  return role === null || hasRole(member, role);
};

// 利用者が申請にできる操作です。操作の決まりの、ロール・本人の条件・今の状態で決まります。
export function getOperations(member: Membership, target: { requesterSub: string; status: RequestStatus }): RequestOperations {
  const allowed = (operation: keyof RequestOperations) => {
    const rule = operationRules[operation];
    return hasRuleRole(member, operation) && (target.requesterSub === member.sub) === rule.own && rule.from.includes(target.status);
  };
  return {
    update: allowed('update'),
    submit: allowed('submit'),
    withdraw: allowed('withdraw'),
    delete: allowed('delete'),
    approve: allowed('approve'),
    reject: allowed('reject'),
    return: allowed('return'),
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

// 操作する前の申請です。操作の文の中で、変える前の状態を監査ログのために読みます。
const previous = alias(request, 'previous');

// 申請を操作し、監査ログを同じトランザクションで追記して、申請の ID を返します。
// 扱える部署の申請のうち、操作の決まり（本人の条件・今の状態）に合うものだけを、操作の遷移先の状態に変えます。遷移先が null のときは、申請を削除します。
async function operate(
  context: Context,
  id: string,
  operation: keyof RequestOperations,
  values: (now: string) => PgUpdateSetSource<typeof request>,
  reason: string | null,
) {
  const { db, member } = context;
  if (!hasRuleRole(member, operation)) {
    throw operationError();
  }
  const rule = operationRules[operation];
  const newStatus = requestTransitions[operation];
  const target = and(
    eq(request.id, id),
    departmentScope(member),
    inArray(request.status, rule.from),
    rule.own ? eq(request.requesterSub, member.sub) : ne(request.requesterSub, member.sub),
  );
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const changed =
      newStatus === null
        ? await tx.delete(request).where(target).returning({ id: request.id, previousStatus: request.status })
        : await tx
            .update(request)
            .set({ ...values(now), status: newStatus, updatedAt: now, updatedBy: member.sub })
            .from(previous)
            .where(and(eq(previous.id, request.id), target))
            .returning({ id: request.id, previousStatus: previous.status });
    const row = changed.at(0);
    if (row === undefined) {
      throw operationError();
    }
    await tx.insert(auditLog).values({
      requestId: row.id,
      action: operation,
      previousStatus: row.previousStatus,
      newStatus,
      reason,
      createdAt: now,
      createdBy: member.sub,
    });
    return row.id;
  });
}

// 説明は空なら未設定にします。
const description = (value: string | null) => (value === '' ? null : value);

// 申請を下書きで作成し、作った申請の ID を返します。部署は申請者の所属部署です。
export async function createRequest(context: Context, values: z.infer<typeof requestSchema>) {
  const { db, member } = context;
  if (!hasRole(member, 'editor')) {
    throw roleError();
  }
  await checkRequestType(context, values.requestTypeId);
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const created = await tx
      .insert(request)
      .values({
        requestTypeId: values.requestTypeId,
        title: values.title,
        description: description(values.description),
        amount: values.amount,
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

// 本人の下書きの、渡した項目だけを編集します。
export async function updateRequest(context: Context, id: string, values: RequestChanges) {
  if (values.requestTypeId !== undefined) {
    await checkRequestType(context, values.requestTypeId);
  }
  return operate(
    context,
    id,
    'update',
    () => ({
      requestTypeId: values.requestTypeId,
      title: values.title,
      description: values.description === undefined ? undefined : description(values.description),
      amount: values.amount,
    }),
    null,
  );
}

// 本人の下書きを提出します。
export async function submitRequest(context: Context, id: string) {
  return operate(context, id, 'submit', (now) => ({ submittedAt: now }), null);
}

// 本人の下書き・提出済みの申請を取り下げます。
export async function withdrawRequest(context: Context, id: string) {
  return operate(context, id, 'withdraw', (now) => ({ withdrawnAt: now }), null);
}

// 本人の下書きを削除します。監査ログは申請を削除した後も残ります。
export async function deleteRequest(context: Context, id: string) {
  return operate(context, id, 'delete', () => ({}), null);
}

// 他者の提出済みの申請を承認します。
export async function approveRequest(context: Context, id: string) {
  return operate(context, id, 'approve', (now) => ({ approvedAt: now, approverSub: context.member.sub }), null);
}

// 他者の提出済みの申請を却下し、理由を残します。
export async function rejectRequest(context: Context, id: string, reason: string) {
  return operate(context, id, 'reject', (now) => ({ rejectedAt: now, rejectionReason: reason }), reason);
}

// 他者の提出済みの申請を下書きに差し戻し、理由を残します。申請者は修正して再提出できます。
export async function returnRequest(context: Context, id: string, reason: string) {
  return operate(context, id, 'return', (now) => ({ returnedAt: now, returnReason: reason }), reason);
}

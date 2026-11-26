import { department, userMembership } from '@workops/blocks/schema';
import { eq } from 'drizzle-orm';
import type { AwsDataApiPgDatabase } from 'drizzle-orm/aws-data-api/pg';

// 利用者の所属・部署名・ロール・全体管理者区分です。所属が未設定ならnullを返します。
export async function getMembership(db: AwsDataApiPgDatabase, sub: string) {
  const memberships = await db
    .select({
      sub: userMembership.sub,
      departmentId: userMembership.departmentId,
      departmentName: department.name,
      role: userMembership.role,
      isAdmin: userMembership.isAdmin,
    })
    .from(userMembership)
    .innerJoin(department, eq(department.id, userMembership.departmentId))
    .where(eq(userMembership.sub, sub));
  return memberships.at(0) ?? null;
}

// 所属が設定された利用者です。
export type Membership = NonNullable<Awaited<ReturnType<typeof getMembership>>>;

// ロールの強さの順です。
const roleRanks: Record<typeof userMembership.$inferSelect['role'], number> = { viewer: 1, editor: 2, manager: 3 };

// 所属が、指定したロール以上かを返します。全体管理者は、どのロールにも当てはまります。
export const hasRole = (
  membership: { role: typeof userMembership.$inferSelect['role']; isAdmin: boolean },
  role: typeof userMembership.$inferSelect['role'],
) =>
  membership.isAdmin || roleRanks[membership.role] >= roleRanks[role];

import { department, userMembership } from '@workops/blocks/schema';
import { eq } from 'drizzle-orm';
import type { AwsDataApiPgDatabase } from 'drizzle-orm/aws-data-api/pg';
import { createSelectSchema } from 'drizzle-orm/zod';
import type { z } from 'zod';

// 所属が設定された利用者です。DB の所属の列と、部署名から作ります。
const membershipSchema = createSelectSchema(userMembership)
  .pick({ sub: true, departmentId: true, role: true, isAdmin: true })
  .extend({ departmentName: createSelectSchema(department).shape.name });
export type Membership = z.infer<typeof membershipSchema>;

// ロールです。DB の所属のロールの列から作ります。
export const memberRole = membershipSchema.shape.role;
export type MemberRole = z.infer<typeof memberRole>;

// 利用者の所属・部署名・ロール・全体管理者区分です。所属が未設定ならnullを返します。
export async function getMembership(db: AwsDataApiPgDatabase, sub: string): Promise<Membership | null> {
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

// ロールの強さの順です。
const roleRanks: Record<MemberRole, number> = { viewer: 1, editor: 2, manager: 3 };

// 所属が、指定したロール以上かを返します。全体管理者は、どのロールにも当てはまります。
export const hasRole = (
  membership: { role: MemberRole; isAdmin: boolean },
  role: MemberRole,
) =>
  membership.isAdmin || roleRanks[membership.role] >= roleRanks[role];

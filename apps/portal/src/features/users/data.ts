import 'server-only';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  type AttributeType,
  paginateListUsers,
  type UserType,
  UserNotFoundException,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import { db } from '@workops/server/db';
import { department, userMembership } from '@workops/blocks/schema';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import type { z } from 'zod';
import { cognito, userPoolId } from '@/cognito';
import { getAdmin } from '@/user';
import type { accountStatus, membershipSchema, userSchema } from './schema';
import type { UserSearchParams } from './search-params';

// 一覧の1ページの件数です。
export const pageSize = 20;

// Cognito のユーザーの属性から、指定した名前の値を取り出します。
const attribute = (attributes: AttributeType[] | undefined, name: string) =>
  attributes?.find((item) => item.Name === name)?.Value;

// すべてのユーザーが持つ属性（sub・email）を取り出します。ないときはエラーにします。
const requiredAttribute = (attributes: AttributeType[] | undefined, name: string) => {
  const value = attribute(attributes, name);
  if (value === undefined) {
    throw new Error(`Cognito のユーザーに ${name} 属性がありません。`);
  }
  return value;
};

// Cognito のユーザーの有効区分と状態から、アカウントの状態を決めます。
const statusOf = (enabled: boolean | undefined, userStatus: string | undefined): z.infer<typeof accountStatus> => {
  if (enabled === false) {
    return 'disabled';
  }
  return userStatus === 'FORCE_CHANGE_PASSWORD' ? 'invited' : 'active';
};

// 所属を部署名と一緒に、利用者識別子ごとに返します。
async function listMemberships() {
  const rows = await db
    .select({
      sub: userMembership.sub,
      departmentId: userMembership.departmentId,
      departmentName: department.name,
      role: userMembership.role,
      isAdmin: userMembership.isAdmin,
    })
    .from(userMembership)
    .innerJoin(department, eq(department.id, userMembership.departmentId));
  return new Map(rows.map((row) => [row.sub, row]));
}

// 共有のユーザープールのユーザーを全件読みます。
async function listCognitoUsers() {
  const users: UserType[] = [];
  for await (const output of paginateListUsers({ client: cognito }, { UserPoolId: userPoolId })) {
    users.push(...(output.Users ?? []));
  }
  return users;
}

// ユーザーの一覧です。名前・メールの部分一致・部署・状態で絞り込み、メールの昇順で1ページ分を返します。
export async function listUsers(conditions: UserSearchParams) {
  await getAdmin();
  const [cognitoUsers, memberships] = await Promise.all([listCognitoUsers(), listMemberships()]);
  const keyword = conditions.q?.toLowerCase();
  const users = cognitoUsers
    .map((user) => {
      const sub = requiredAttribute(user.Attributes, 'sub');
      return {
        sub,
        name: attribute(user.Attributes, 'name'),
        email: requiredAttribute(user.Attributes, 'email'),
        status: statusOf(user.Enabled, user.UserStatus),
        membership: memberships.get(sub) ?? null,
      };
    })
    .filter(
      (user) =>
        (keyword === undefined ||
          user.email.toLowerCase().includes(keyword) ||
          (user.name?.toLowerCase().includes(keyword) ?? false)) &&
        (conditions.department === null || user.membership?.departmentId === conditions.department) &&
        (conditions.status === null || user.status === conditions.status),
    )
    .sort((a, b) => a.email.localeCompare(b.email));
  const start = (conditions.page - 1) * pageSize;
  return { total: users.length, start, users: users.slice(start, start + pageSize) };
}

// 部署の選択肢です。表示順・部署コードの順で返します。
export async function listDepartmentOptions() {
  await getAdmin();
  return db
    .select({ id: department.id, name: department.name })
    .from(department)
    .orderBy(asc(department.sortOrder), asc(department.code));
}

// ユーザーの詳細です。見つからなければ、見つからない画面を表示します。
export async function getUser(sub: string) {
  await getAdmin();
  const output = await cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: sub })).catch((error) => {
    if (error instanceof UserNotFoundException) {
      notFound();
    }
    throw error;
  });
  const memberships = await db
    .select({ departmentId: userMembership.departmentId, role: userMembership.role, isAdmin: userMembership.isAdmin })
    .from(userMembership)
    .where(eq(userMembership.sub, sub));
  return {
    sub,
    name: attribute(output.UserAttributes, 'name'),
    email: requiredAttribute(output.UserAttributes, 'email'),
    status: statusOf(output.Enabled, output.UserStatus),
    invitedAt: output.UserCreateDate,
    membership: memberships.at(0) ?? null,
  };
}

// ユーザーの一覧の1行の型です。
export type UserRow = Awaited<ReturnType<typeof listUsers>>['users'][number];

// 部署の選択肢の1件の型です。
export type DepartmentOption = Awaited<ReturnType<typeof listDepartmentOptions>>[number];

// ユーザーの詳細の型です。
export type UserDetail = Awaited<ReturnType<typeof getUser>>;

// 所属（部署・ロール・全体管理者）を登録または更新します。作成者・更新者はログイン中の利用者です。
export async function saveMembership(values: z.infer<typeof membershipSchema>) {
  const admin = await getAdmin();
  const now = new Date().toISOString();
  const columns = { departmentId: values.departmentId, role: values.role, isAdmin: values.isAdmin };
  await db
    .insert(userMembership)
    .values({ sub: values.sub, ...columns, createdAt: now, createdBy: admin.sub, updatedAt: now, updatedBy: admin.sub })
    .onConflictDoUpdate({ target: userMembership.sub, set: { ...columns, updatedAt: now, updatedBy: admin.sub } });
}

// ユーザーを作成して招待メールを送ります。作成したユーザーの利用者識別子を返し、メールのユーザーがすでにいるときは null を返します。
export async function createUser(values: z.infer<typeof userSchema>) {
  await getAdmin();
  const output = await cognito
    .send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: values.email,
        UserAttributes: [
          { Name: 'email', Value: values.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: values.name },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    )
    .catch((error) => {
      if (error instanceof UsernameExistsException) {
        return null;
      }
      throw error;
    });
  return output && requiredAttribute(output.User?.Attributes, 'sub');
}

// 招待中のユーザーに、招待メールを送り直します。
export async function resendInvitation(email: string) {
  await getAdmin();
  await cognito.send(
    new AdminCreateUserCommand({ UserPoolId: userPoolId, Username: email, MessageAction: 'RESEND', DesiredDeliveryMediums: ['EMAIL'] }),
  );
}

// ユーザーを有効にします。
export async function enableUser(sub: string) {
  await getAdmin();
  await cognito.send(new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: sub }));
}

// ユーザーを無効にします。無効にしたユーザーはログインできません。
export async function disableUser(sub: string) {
  await getAdmin();
  await cognito.send(new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: sub }));
}

// ユーザーを削除し、所属も消します。
export async function deleteUser(sub: string) {
  await getAdmin();
  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: sub }));
  await db.delete(userMembership).where(eq(userMembership.sub, sub));
}

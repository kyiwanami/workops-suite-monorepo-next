import {
  type AttributeType,
  type CognitoIdentityProviderClient,
  ListUsersCommand,
  paginateListUsers,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import { user } from '@workops/blocks/schema';
import { eq, notInArray, sql } from 'drizzle-orm';
import type { AwsDataApiPgDatabase } from 'drizzle-orm/aws-data-api/pg';
import type { Context } from './context';

// 共有のユーザープールのユーザーを全件読みます。
export async function listCognitoUsers(cognito: CognitoIdentityProviderClient, userPoolId: string) {
  const users: UserType[] = [];
  for await (const output of paginateListUsers({ client: cognito }, { UserPoolId: userPoolId })) {
    users.push(...(output.Users ?? []));
  }
  return users;
}

// Cognito のユーザーの属性から、指定した名前の値を取り出します。
export const attribute = (attributes: AttributeType[] | undefined, name: string) =>
  attributes?.find((item) => item.Name === name)?.Value;

// すべてのユーザーが持つ属性（sub・email）を取り出します。ないときはエラーにします。
export const requiredAttribute = (attributes: AttributeType[] | undefined, name: string) => {
  const value = attribute(attributes, name);
  if (value === undefined) {
    throw new Error(`Cognito のユーザーに ${name} 属性がありません。`);
  }
  return value;
};

// 利用者の名前です。名前が未設定の利用者は、メールにします。
export const userName = sql<string>`coalesce(${user.name}, ${user.email})`;

// 利用者識別子から、DB の利用者の名前を返します。いなければ null を返します。
export async function getUserName(context: Context, sub: string) {
  const rows = await context.db.select({ name: userName }).from(user).where(eq(user.sub, sub));
  return rows.at(0)?.name ?? null;
}

// 利用者の同期の印です。DB の利用者の作成者・更新者に入れます。
const syncActor = 'cognito-sync';

// Cognito の利用者を、DB の利用者の今の値で追加・更新します。
async function saveUsers(db: AwsDataApiPgDatabase, cognitoUsers: UserType[]) {
  if (cognitoUsers.length === 0) {
    return;
  }
  const now = new Date().toISOString();
  await db
    .insert(user)
    .values(
      cognitoUsers.map((cognitoUser) => ({
        sub: requiredAttribute(cognitoUser.Attributes, 'sub'),
        name: attribute(cognitoUser.Attributes, 'name') ?? null,
        email: requiredAttribute(cognitoUser.Attributes, 'email'),
        enabled: cognitoUser.Enabled === true,
        createdAt: now,
        createdBy: syncActor,
        updatedAt: now,
        updatedBy: syncActor,
      })),
    )
    .onConflictDoUpdate({
      target: user.sub,
      set: { name: sql`excluded."name"`, email: sql`excluded."email"`, enabled: sql`excluded."enabled"`, updatedAt: now, updatedBy: syncActor },
    });
}

// 利用者識別子の利用者を、Cognito の今の状態に合わせて DB に反映します。Cognito にいなければ、DB から削除します。
export async function syncUser(db: AwsDataApiPgDatabase, cognito: CognitoIdentityProviderClient, userPoolId: string, sub: string) {
  const output = await cognito.send(new ListUsersCommand({ UserPoolId: userPoolId, Filter: `sub = "${sub}"`, Limit: 1 }));
  const found = output.Users?.at(0);
  if (found === undefined) {
    await db.delete(user).where(eq(user.sub, sub));
    return;
  }
  await saveUsers(db, [found]);
}

// Cognito の利用者を全件 DB に反映し、Cognito にいない利用者を DB から削除します。初回の取り込みに使います。
export async function syncAllUsers(db: AwsDataApiPgDatabase, cognito: CognitoIdentityProviderClient, userPoolId: string) {
  const cognitoUsers = await listCognitoUsers(cognito, userPoolId);
  await saveUsers(db, cognitoUsers);
  const subs = cognitoUsers.map((cognitoUser) => requiredAttribute(cognitoUser.Attributes, 'sub'));
  await db.delete(user).where(subs.length === 0 ? undefined : notInArray(user.sub, subs));
}

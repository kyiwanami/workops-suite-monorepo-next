import {
  type AttributeType,
  type CognitoIdentityProviderClient,
  paginateListUsers,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
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

// Cognito の利用者を、利用者識別子・名前（未設定ならメール）・メール・有効区分の形で返します。
export async function listUsers(context: Context) {
  const users = await listCognitoUsers(context.cognito, context.userPoolId);
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

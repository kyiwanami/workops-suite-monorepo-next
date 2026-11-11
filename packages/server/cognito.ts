import 'server-only';
import {
  type AttributeType,
  CognitoIdentityProviderClient,
  paginateListUsers,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import outputs from '@workops/backend/outputs';

// 共有のユーザープールのユーザーを読み書きする Cognito のクライアントです。認証情報は AWS SDK の既定の取得順で得ます。
export const cognito = new CognitoIdentityProviderClient({ region: outputs.auth.aws_region });

// 共有のユーザープールの ID です。
export const userPoolId = outputs.auth.user_pool_id;

// 共有のユーザープールのユーザーを全件読みます。
export async function listCognitoUsers() {
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

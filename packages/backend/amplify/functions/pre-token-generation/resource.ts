import { defineFunction } from '@aws-amplify/backend';

// トークンを作る前に、利用者のロールと全体管理者区分をアクセストークンに入れる関数です。
// ユーザープールと同じスタックに置きます。Cognito はこの関数を5秒で打ち切るため、同じ長さで止めます。ログは90日残します。
export const preTokenGeneration = defineFunction({
  name: 'pre-token-generation',
  runtime: 24,
  timeoutSeconds: 5,
  resourceGroupName: 'auth',
  logging: { retention: '3 months' },
});

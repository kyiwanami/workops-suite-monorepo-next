import { defineFunction } from '@aws-amplify/backend';

// Cognito の利用者の操作を、DB の利用者に反映する関数です。ユーザープールと同じスタックに置き、ログは90日残します。
// 自動停止した Aurora の再開を待てるよう、1分で止めます。
export const userSync = defineFunction({
  name: 'user-sync',
  runtime: 24,
  timeoutSeconds: 60,
  resourceGroupName: 'auth',
  logging: { retention: '3 months' },
});

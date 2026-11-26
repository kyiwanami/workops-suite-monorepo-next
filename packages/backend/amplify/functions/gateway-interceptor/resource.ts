import { defineFunction } from '@aws-amplify/backend';

// Gateway が業務MCPサーバーを呼ぶ前に、ツールを呼んだ利用者を要求に入れる関数です。
// AI機能のスタックに置き、ログは90日残します。
export const gatewayInterceptor = defineFunction({
  name: 'gateway-interceptor',
  runtime: 24,
  resourceGroupName: 'ai',
  logging: { retention: '3 months' },
});

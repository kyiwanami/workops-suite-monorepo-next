import { defineFunction } from '@aws-amplify/backend';

// Gateway がツールの定義を取り直し終えるまで、デプロイを待たせる関数です。
export const waitGatewayTarget = defineFunction({
  name: 'wait-gateway-target',
  runtime: 24,
  resourceGroupName: 'ai',
});

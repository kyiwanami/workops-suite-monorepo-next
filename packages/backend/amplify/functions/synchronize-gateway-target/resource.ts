import { defineFunction } from '@aws-amplify/backend';

// 業務MCPサーバーのコードが変わったときに、Gateway にツールの定義を取り直させる関数です。
export const synchronizeGatewayTarget = defineFunction({
  name: 'synchronize-gateway-target',
  runtime: 24,
  resourceGroupName: 'ai',
});

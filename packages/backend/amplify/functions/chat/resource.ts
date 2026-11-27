import { defineFunction } from '@aws-amplify/backend';

// チャットのAPIの処理です。AIの回答を逐次返し、書込みのツールは確認カードで承認されてから実行します。
// AI機能のスタックに置きます。Harness の上限の300秒より長く待ちます。ログは90日残します。
export const chat = defineFunction({
  name: 'chat',
  runtime: 24,
  resourceGroupName: 'ai',
  timeoutSeconds: 360,
  logging: { retention: '3 months' },
});
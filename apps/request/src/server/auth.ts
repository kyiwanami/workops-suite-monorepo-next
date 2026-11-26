import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import outputs from '@workops/backend-request/outputs';

// 申請管理のクライアントで、共有のCognitoをNext.jsのサーバー側から使います。トークンはアプリごとのCookieに保存します。
export const { runWithAmplifyServerContext, createAuthRouteHandlers } = createServerRunner({
  config: outputs,
});

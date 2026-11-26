import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import outputs from '@workops/backend-portal/outputs';

// ポータルのクライアントで、共有のCognitoをNext.jsのサーバー側から使います。トークンはアプリごとのCookieに保存します。
export const { runWithAmplifyServerContext, createAuthRouteHandlers } = createServerRunner({
  config: outputs,
});

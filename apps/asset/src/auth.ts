import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import outputs from '@workops/backend-asset/outputs';

// 資産カタログのクライアントで、共有のCognitoをNext.jsのサーバー側から使います。トークンはアプリごとのCookieに保存します。
export const { runWithAmplifyServerContext, createAuthRouteHandlers } = createServerRunner({
  config: outputs,
});

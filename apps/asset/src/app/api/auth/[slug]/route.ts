import { createAuthRouteHandlers } from '@/auth';

// マネージドログインでのサインイン・サインアウトと、その戻り先を処理します。
export const GET = createAuthRouteHandlers({
  redirectOnSignInComplete: '/',
  redirectOnSignOutComplete: '/',
});

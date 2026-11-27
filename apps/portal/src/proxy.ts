import { createProxy } from '@workops/server/proxy';
import { runWithAmplifyServerContext } from '@/server/auth';

// 未ログインの利用者をサインインへ転送し、セキュリティヘッダーを付けます。
export const proxy = createProxy(runWithAmplifyServerContext, []);

// サインインの処理と静的なファイルと、リンクの先読みの要求は対象にしません（先読みの除外は Next.js の CSP のガイドの形）。
export const config = {
  matcher: [
    {
      source: '/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

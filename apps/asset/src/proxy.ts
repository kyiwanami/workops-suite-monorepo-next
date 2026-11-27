import { chatApiUrl } from '@workops/server/chat';
import { createSecurityHeaders } from '@workops/server/security-headers';
import { runWithAmplifyServerContext } from '@/server/auth';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { type NextRequest, NextResponse } from 'next/server';

// 未ログインの利用者をサインインへ転送します。期限切れのトークンはここで更新し、Cookieに書き戻します。
// セキュリティヘッダー（Nosecone の既定値）を応答に付けます。Next.js が proxy の応答のヘッダーを要求にも写すため、描画で CSP の nonce を使えます。画面から呼ぶチャットのAPIのオリジンを接続先に足します。
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ headers: createSecurityHeaders([new URL(chatApiUrl).origin]) });
  const signedIn = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: async (contextSpec) => {
      const session = await fetchAuthSession(contextSpec);
      return session.tokens?.accessToken !== undefined && session.tokens.idToken !== undefined;
    },
  });
  if (signedIn) {
    return response;
  }
  // ログイン画面は日本語で表示します。
  return NextResponse.redirect(new URL('/api/auth/sign-in?lang=ja', request.url));
}

// サインインの処理と静的なファイルと、リンクの先読みの要求は対象にしません（先読みの除外は Next.js の CSP のガイドの形）。
export const config = {
  matcher: [
    {
      source: '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

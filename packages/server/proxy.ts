import type { NextServer } from '@aws-amplify/adapter-nextjs';
import { defaults, nosecone } from '@nosecone/next';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { type NextRequest, NextResponse } from 'next/server';
import type { HostSource } from 'nosecone';

// CSP の接続先に書けるオリジンかを確かめます。設定から読む URL を、Nosecone のホストの書き方の型にします。
function isHostSource(value: string): value is HostSource {
  return URL.canParse(value);
}

// 各アプリの proxy の処理を、アプリのクライアントの設定で作ります。
// 未ログインの利用者をサインインへ転送します。期限切れのトークンはここで更新し、Cookieに書き戻します。
// セキュリティヘッダー（Nosecone の既定値）を応答に付けます。Next.js が proxy の応答のヘッダーを要求にも写すため、描画で CSP の nonce を使えます。
// connectOrigins は、画面から呼ぶほかのオリジン（チャットのAPI）です。CSP の接続先に足します。
export const createProxy = (runWithAmplifyServerContext: NextServer.RunOperationWithContext, connectOrigins: string[]) => {
  const options = {
    ...defaults,
    contentSecurityPolicy: {
      directives: {
        ...defaults.contentSecurityPolicy.directives,
        connectSrc: [...defaults.contentSecurityPolicy.directives.connectSrc, ...connectOrigins.filter(isHostSource)],
      },
    },
  };
  return async function proxy(request: NextRequest) {
    // nonce は要求ごとに作るため、ヘッダーも要求ごとに作る
    const response = NextResponse.next({ headers: nosecone(options) });
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
    // ログインしていなければサインインへ。ログイン画面は日本語で表示する
    return NextResponse.redirect(new URL('/api/auth/sign-in?lang=ja', request.url));
  };
};

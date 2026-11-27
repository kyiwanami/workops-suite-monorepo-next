import 'server-only';
import type { NextServer } from '@aws-amplify/adapter-nextjs';
import outputs from '@workops/backend/outputs';
import type { ChatToken } from '@workops/schema/chat';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';
import type { HostSource } from 'nosecone';

// チャットのAPIのURLです。Amplifyの出力から読み、画面のレイアウトからAIのパネルに渡します。
// 出力にはDBの接続先も入っているため、ブラウザでは読み込みません。
export const chatApiUrl = outputs.custom.chatApiUrl;

// CSP の接続先に書けるオリジンかを確かめます。
function isHostSource(value: string): value is HostSource {
  return URL.canParse(value);
}

// チャットのAPIのオリジンです。画面から呼ぶため、proxy で CSP の接続先に足します。
export const chatApiOrigin = (() => {
  const origin = new URL(chatApiUrl).origin;
  if (!isHostSource(origin)) {
    throw new Error(`チャットのAPIのURLが正しくありません: ${chatApiUrl}`);
  }
  return origin;
})();

// AIのパネルがチャットのAPIを呼ぶための、ログイン中の利用者のアクセストークンを返す Route Handler を、アプリのクライアントの設定で作ります。応答は保存させません。
// トークンの Cookie は Amplify の既定で SameSite=Strict のため、ほかのサイトからの要求には付かず、proxy が 401 を返します。
// 期限の近いトークンは BFF のトークン交換で断られるため、更新したトークンを返します。
export const createChatTokenRoute = (runWithAmplifyServerContext: NextServer.RunOperationWithContext) =>
  async function GET() {
    const accessToken = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async (contextSpec) => (await fetchAuthSession(contextSpec, { forceRefresh: true })).tokens?.accessToken.toString(),
    });
    // トークンを更新できなかった
    if (accessToken === undefined) {
      return new Response(null, { status: 401 });
    }
    return Response.json({ accessToken } satisfies ChatToken, { headers: { 'Cache-Control': 'no-store' } });
  };

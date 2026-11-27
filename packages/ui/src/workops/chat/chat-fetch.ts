import { chatTokenSchema } from '@workops/schema/chat';

// チャットのAPIを呼ぶためのトークンです。画面のサーバーから受け取り、このタブのメモリにだけ持ちます。
let token: Promise<string> | undefined;

// 画面のサーバーから、利用者のアクセストークンを受け取ります。受け取れなかったときは、次の呼び出しで受け取り直します。
function fetchToken() {
  token = fetch('/api/chat-token', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('トークンを受け取れませんでした。');
      }
      return chatTokenSchema.parse(await response.json()).accessToken;
    })
    .catch((error) => {
      token = undefined;
      throw error;
    });
  return token;
}

// トークンを付けてチャットのAPIを呼びます。
async function send(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${await (token ?? fetchToken())}`);
  return fetch(input, { ...init, headers });
}

// チャットのAPIを呼びます。AI SDK の transport の fetch と、会話の一覧・履歴の取得に使います。
// トークンの期限が切れて 401 になったら、トークンを受け取り直して1回だけ送り直します。
export async function chatFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await send(input, init);
  if (response.status !== 401) {
    return response;
  }
  token = undefined;
  return send(input, init);
}

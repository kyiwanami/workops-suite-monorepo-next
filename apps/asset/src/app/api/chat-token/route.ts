import { chatTokenSchema } from '@workops/schema/chat';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';
import type { z } from 'zod';
import { runWithAmplifyServerContext } from '@/server/auth';

// AIのパネルがチャットのAPIを呼ぶための、ログイン中の利用者のアクセストークンを返します。応答は保存させません。
// トークンの Cookie は Amplify の既定で SameSite=Strict のため、ほかのサイトからの要求には付かず、401 になります。
// 期限の近いトークンは BFF のトークン交換で断られるため、更新したトークンを返します。
export async function GET() {
  const accessToken = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => (await fetchAuthSession(contextSpec, { forceRefresh: true })).tokens?.accessToken.toString(),
  });
  if (accessToken === undefined) {
    return new Response(null, { status: 401 });
  }
  return Response.json({ accessToken } satisfies z.infer<typeof chatTokenSchema>, { headers: { 'Cache-Control': 'no-store' } });
}

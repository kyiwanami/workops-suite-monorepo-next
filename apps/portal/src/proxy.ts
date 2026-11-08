import { runWithAmplifyServerContext } from '@/auth';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { type NextRequest, NextResponse } from 'next/server';

// 未ログインの利用者をサインインへ転送します。期限切れのトークンはここで更新し、Cookieに書き戻します。
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
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
  return NextResponse.redirect(new URL('/api/auth/sign-in', request.url));
}

export const config = {
  matcher: '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
};

import 'server-only';
import type { createServerRunner } from '@aws-amplify/adapter-nextjs';
import * as membership from '@workops/domain/membership';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { db } from './db';

// ログイン中の利用者を取得する処理を、アプリのクライアントの設定で作ります。
export const createUserQueries = (
  runWithAmplifyServerContext: ReturnType<typeof createServerRunner>['runWithAmplifyServerContext'],
) => {
  // ログイン中の利用者です。1回のリクエストの中では結果を使い回します。
  const getUser = cache(() =>
    runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => getCurrentUser(contextSpec),
    }),
  );

  // ログイン中の利用者の所属・部署名・ロール・全体管理者区分です。所属が未設定ならnullを返します。
  const getMembership = cache(async () => membership.getMembership(db, (await getUser()).userId));

  // ログイン中の利用者のメールです。IDトークンの email から取ります。
  const getEmail = cache(async () => {
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    });
    const email = session.tokens?.idToken?.payload.email;
    return typeof email === 'string' ? email : undefined;
  });

  return { getMembership, getEmail };
};

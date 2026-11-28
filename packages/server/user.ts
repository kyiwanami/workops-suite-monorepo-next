import 'server-only';
import type { NextServer } from '@aws-amplify/adapter-nextjs';
import * as membership from '@workops/domain/membership';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getApps } from './app';
import { db } from './db';

// ログイン中の利用者を取得する処理を、アプリのクライアントの設定で作ります。
export const createUserQueries = (runWithAmplifyServerContext: NextServer.RunOperationWithContext) => {
  // ログイン中の利用者の ID トークンの中身です。1回のリクエストの中では結果を使い回します。
  const getIdToken = cache(async () => {
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    });
    const payload = session.tokens?.idToken?.payload;
    if (payload?.sub === undefined) {
      throw new Error('ログインしていません。');
    }
    return { sub: payload.sub, email: payload.email };
  });

  // ログイン中の利用者の所属・部署名・ロール・全体管理者区分です。所属が未設定ならnullを返します。
  const getMembership = cache(async () => membership.getMembership(db, (await getIdToken()).sub));

  // ログイン中の利用者のメールです。IDトークンの email から取ります。
  const getEmail = async () => {
    const { email } = await getIdToken();
    return typeof email === 'string' ? email : undefined;
  };

  // 業務のアプリを使う利用者の所属です。所属が未設定なら、ポータルの所属が未設定の案内へ転送します。
  const getMember = async () => {
    const member = await getMembership();
    if (member === null) {
      const portal = (await getApps()).find((app) => app.appId === 'portal');
      redirect(`${portal?.urlDomain}/setup-required`);
    }
    return member;
  };

  // ログイン中の利用者が業務の処理を呼ぶときの、接続と利用者です。
  const getContext = async () => ({ db, member: await getMember() });

  return { getMembership, getEmail, getMember, getContext };
};

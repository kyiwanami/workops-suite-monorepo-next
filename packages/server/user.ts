import 'server-only';
import type { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { userMembership } from '@workops/blocks/schema';
import { fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth/server';
import { eq } from 'drizzle-orm';
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

  // ログイン中の利用者の所属・ロール・全体管理者区分です。所属が未設定ならnullを返します。
  const getMembership = cache(async () => {
    const user = await getUser();
    const memberships = await db
      .select({
        sub: userMembership.sub,
        departmentId: userMembership.departmentId,
        role: userMembership.role,
        isAdmin: userMembership.isAdmin,
      })
      .from(userMembership)
      .where(eq(userMembership.sub, user.userId));
    return memberships.at(0) ?? null;
  });

  // ログイン中の利用者のメールです。
  const getEmail = cache(async () => {
    const attributes = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchUserAttributes(contextSpec),
    });
    return attributes.email;
  });

  return { getMembership, getEmail };
};

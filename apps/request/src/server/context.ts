import 'server-only';
import { cognito, userPoolId } from '@workops/server/cognito';
import { db } from '@workops/server/db';
import { notFound } from 'next/navigation';
import { getMember } from './user';

// 申請管理でログイン中の利用者が業務の処理を呼ぶときの、接続と利用者です。
export async function getContext() {
  return { db, cognito, userPoolId, member: await getMember() };
}

// 業務の処理が null を返したとき（見つからない・権限がない）は、見つからない画面を表示します。
export function found<T>(value: T | null) {
  if (value === null) {
    notFound();
  }
  return value;
}

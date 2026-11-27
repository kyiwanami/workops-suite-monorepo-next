import 'server-only';
import { createUserQueries } from '@workops/server/user';
import { notFound } from 'next/navigation';
import { runWithAmplifyServerContext } from './auth';

// ポータルでログイン中の利用者の所属とメールと、業務の処理に渡す文脈を取得します。
export const { getMembership, getEmail, getMember, getContext } = createUserQueries(runWithAmplifyServerContext);

// 管理の画面と操作は全体管理者だけに許可します。権限がなければ、見つからない画面を表示します。
export async function getAdmin() {
  const membership = await getMembership();
  if (membership === null || !membership.isAdmin) {
    notFound();
  }
  return membership;
}

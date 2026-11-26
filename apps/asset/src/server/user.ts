import 'server-only';
import { getApps } from '@workops/server/app';
import { createUserQueries } from '@workops/server/user';
import { redirect } from 'next/navigation';
import { runWithAmplifyServerContext } from './auth';

// 資産カタログでログイン中の利用者の所属とメールを取得します。
export const { getMembership, getEmail } = createUserQueries(runWithAmplifyServerContext);

// 資産カタログを使う利用者の所属です。所属が未設定なら、ポータルの所属が未設定の案内へ転送します。
export async function getMember() {
  const membership = await getMembership();
  if (membership === null) {
    const portal = (await getApps()).find((app) => app.appId === 'portal');
    redirect(`${portal?.urlDomain}/setup-required`);
  }
  return membership;
}

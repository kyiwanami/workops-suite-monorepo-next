import { getApps } from '@workops/server/app';
import { AppHeader } from '@workops/ui/workops/app-header';
import { getEmail, getMembership } from '@/user';

// ポータルで表示する共通のヘッダーです。アプリの一覧とログイン中の利用者の所属を渡します。
export async function Header() {
  const [apps, email, membership] = await Promise.all([getApps(), getEmail(), getMembership()]);
  return <AppHeader apps={apps} currentAppId="portal" email={email} membership={membership} />;
}

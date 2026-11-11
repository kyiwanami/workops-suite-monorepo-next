import { roleLabels } from '@workops/ui/lib/roles';
import { AppNav } from './app-nav';
import { Logo } from './logo';
import { UserMenu } from './user-menu';

// 全アプリ共通のヘッダーです。シンボルと製品名、アプリの切替、利用者と所属・ロール、ユーザーメニューを並べます。
export function AppHeader({
  apps,
  currentAppId,
  email,
  membership,
}: {
  apps: { appId: string; name: string; urlDomain: string }[];
  currentAppId: string;
  email: string | undefined;
  membership: { departmentName: string; role: string; isAdmin: boolean } | null;
}) {
  const portal = apps.find((app) => app.appId === 'portal');
  // 「部署・ロール」の表示です。所属が未設定の利用者には出しません。
  const affiliation =
    membership && `${membership.departmentName}・${membership.isAdmin ? '全体管理者' : roleLabels[membership.role]}`;
  // 全体管理者だけに出す「管理」の行き先です。ポータルのユーザー管理を開きます。
  const adminUrl = membership?.isAdmin && portal ? `${portal.urlDomain}/admin/users` : null;
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4">
      <a href={portal?.urlDomain} className="flex items-center gap-2 text-base font-bold whitespace-nowrap text-foreground no-underline">
        <Logo />
        Workops Suite
      </a>
      <AppNav apps={apps} currentAppId={currentAppId} adminUrl={adminUrl} />
      <div className="ml-auto hidden text-right text-xs whitespace-nowrap text-muted-foreground md:block">
        <strong className="block text-sm text-foreground">{email}</strong>
        {affiliation}
      </div>
      <UserMenu email={email} affiliation={affiliation} apps={apps} currentAppId={currentAppId} adminUrl={adminUrl} />
    </header>
  );
}

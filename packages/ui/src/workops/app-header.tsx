import { cn } from '@workops/ui/lib/utils';
import { Logo } from './logo';
import { UserMenu } from './user-menu';

// 画面に出すロールの名前です。全体管理者は、ロールにかかわらず「全体管理者」と出します。
const roleLabels: Record<string, string> = { viewer: '閲覧者', editor: '担当者', manager: '承認者' };

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
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4">
      <a href={portal?.urlDomain} className="flex items-center gap-2 text-base font-bold whitespace-nowrap text-foreground no-underline">
        <Logo />
        Workops Suite
      </a>
      <nav className="hidden gap-1 self-stretch md:flex">
        {apps.map((app) => (
          <a
            key={app.appId}
            href={app.urlDomain}
            className={cn(
              'flex items-center border-y-2 border-t-transparent px-3 text-sm font-bold whitespace-nowrap no-underline transition-colors duration-150 ease-out',
              app.appId === currentAppId
                ? 'border-b-primary text-primary'
                : 'border-b-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {app.name}
          </a>
        ))}
      </nav>
      <div className="ml-auto hidden text-right text-xs whitespace-nowrap text-muted-foreground md:block">
        <strong className="block text-sm text-foreground">{email}</strong>
        {affiliation}
      </div>
      <UserMenu email={email} affiliation={affiliation} apps={apps} currentAppId={currentAppId} />
    </header>
  );
}

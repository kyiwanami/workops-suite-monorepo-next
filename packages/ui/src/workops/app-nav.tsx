'use client';

import { cn } from '@workops/ui/lib/utils';
import { usePathname } from 'next/navigation';

// アプリの切替に並べる項目です。全体管理者には最後に「管理」を足します。
// ポータルの中では、管理の画面で「管理」を、それ以外で「ポータル」を選択中にします。
export function useNavItems(
  apps: { appId: string; name: string; urlDomain: string }[],
  currentAppId: string,
  adminUrl: string | null,
) {
  const pathname = usePathname();
  const isAdminPage = currentAppId === 'portal' && pathname.startsWith('/admin');
  const items = apps.map((app) => ({
    key: app.appId,
    name: app.name,
    href: app.urlDomain,
    current: app.appId === currentAppId && !isAdminPage,
  }));
  if (adminUrl !== null) {
    items.push({ key: 'admin', name: '管理', href: adminUrl, current: isAdminPage });
  }
  return items;
}

// 広い画面のヘッダーに横に並べるアプリの切替です。選択中は primary の文字と下線で示します。
export function AppNav({
  apps,
  currentAppId,
  adminUrl,
}: {
  apps: { appId: string; name: string; urlDomain: string }[];
  currentAppId: string;
  adminUrl: string | null;
}) {
  const items = useNavItems(apps, currentAppId, adminUrl);
  return (
    <nav className="hidden gap-1 self-stretch md:flex">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className={cn(
            'flex items-center border-y-2 border-t-transparent px-3 text-sm font-bold whitespace-nowrap no-underline transition-colors duration-150 ease-out',
            item.current
              ? 'border-b-primary text-primary'
              : 'border-b-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {item.name}
        </a>
      ))}
    </nav>
  );
}

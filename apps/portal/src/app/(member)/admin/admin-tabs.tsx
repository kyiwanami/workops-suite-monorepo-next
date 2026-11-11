'use client';

import { cn } from '@workops/ui/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 管理の画面の一覧です。
const tabs = [
  { href: '/admin/users', name: 'ユーザー' },
  { href: '/admin/departments', name: '部署' },
  { href: '/admin/apps', name: 'アプリ・ページ' },
];

// 管理の画面を切り替えるタブです。表示中の画面は primary の文字と下線で示します。
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-bold whitespace-nowrap no-underline transition-colors duration-150 ease-out',
            pathname.startsWith(tab.href)
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.name}
        </Link>
      ))}
    </nav>
  );
}

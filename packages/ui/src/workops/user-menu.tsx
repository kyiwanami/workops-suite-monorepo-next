'use client';

import { cn } from '@workops/ui/lib/utils';
import { Avatar, AvatarFallback } from '@workops/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workops/ui/components/dropdown-menu';
import { useTheme } from 'next-themes';

// アバターから開くユーザーメニューです。利用者と所属・ロールの表示、狭い画面でのアプリの切替、テーマの切替、ログアウトを置きます。
export function UserMenu({
  email,
  affiliation,
  apps,
  currentAppId,
}: {
  email: string | undefined;
  affiliation: string | null;
  apps: { appId: string; name: string; urlDomain: string }[];
  currentAppId: string;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-auto rounded-full md:ml-0">
        <Avatar>
          <AvatarFallback>{email?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      {/* 幅はアバターではなく、メールと項目の長さに合わせます。 */}
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          <strong className="block text-sm text-popover-foreground">{email}</strong>
          {affiliation}
        </DropdownMenuLabel>
        <DropdownMenuGroup className="md:hidden">
          <DropdownMenuSeparator />
          {apps.map((app) => (
            <DropdownMenuItem
              key={app.appId}
              asChild
              className={cn('min-h-11 font-bold', app.appId === currentAppId && 'text-primary')}
            >
              <a href={app.urlDomain}>{app.name}</a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">ライト</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">ダーク</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">OS の設定に合わせる</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/api/auth/sign-out">ログアウト</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

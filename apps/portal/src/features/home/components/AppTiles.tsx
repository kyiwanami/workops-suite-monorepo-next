import { Empty, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import { ExternalLink } from 'lucide-react';
import type { listHomeApps } from '../data';
import { AppIcon } from './AppIcon';

// アプリごとのタイルです。上部を押すとアプリを、下に並ぶページの行を押すとそのページを、別タブで開きます。
// 1つの対象に押し場所は1つだけにします。
export function AppTiles({ apps }: { apps: Awaited<ReturnType<typeof listHomeApps>> }) {
  if (apps.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>使えるアプリはまだありません</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(380px,100%),1fr))] items-start gap-4">
      {apps.map((app) => (
        <section key={app.appId} className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <a
            href={app.urlDomain}
            target="_blank"
            rel="noreferrer"
            className="grid gap-1 p-4 no-underline transition-colors duration-150 ease-out hover:bg-muted/50"
          >
            <span className="flex items-center gap-2 text-base font-bold text-foreground">
              <AppIcon name={app.iconName} />
              {app.name}
              <ExternalLink className="ml-auto size-4 text-muted-foreground" />
            </span>
            {app.description !== null && <span className="text-sm text-muted-foreground">{app.description}</span>}
          </a>
          {app.pages.length > 0 && (
            <ul className="border-t">
              {app.pages.map((page) => (
                <li key={page.pageId} className="border-b last:border-b-0">
                  <a
                    href={`${app.urlDomain}${page.relativePath ?? ''}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 px-4 py-3 no-underline transition-colors duration-150 ease-out hover:bg-muted/50"
                  >
                    <span className="grid gap-0.5">
                      <span className="text-sm font-bold text-foreground">{page.name}</span>
                      {page.description !== null && <span className="text-xs text-muted-foreground">{page.description}</span>}
                    </span>
                    <ExternalLink className="ml-auto size-4 shrink-0 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

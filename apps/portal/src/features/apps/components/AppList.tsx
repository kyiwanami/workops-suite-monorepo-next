import { Button } from '@workops/ui/components/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@workops/ui/components/card';
import { Empty, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workops/ui/components/table';
import type { AppRow } from '../data';
import { pageRoleLabels } from '../labels';
import { AppDialog } from './AppDialog';
import { PageDialog } from './PageDialog';

// アプリごとに配下のページを並べます。アプリ名・ページ名を押すと編集のダイアログが開きます。
export function AppList({ apps }: { apps: AppRow[] }) {
  if (apps.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>アプリはまだありません</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return apps.map((app) => (
    <Card key={app.appId}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-x-3">
          <AppDialog app={app}>
            <button type="button" className="font-bold text-primary hover:underline">
              {app.name}
            </button>
          </AppDialog>
          <span className="font-mono text-xs font-normal text-muted-foreground">ID：{app.appId}</span>
        </CardTitle>
        <CardAction>
          <PageDialog appId={app.appId} page={null}>
            <Button variant="outline" size="sm">
              ページを追加する
            </Button>
          </PageDialog>
        </CardAction>
      </CardHeader>
      <CardContent>
        {app.pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">ページはまだありません</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>相対パス</TableHead>
                  <TableHead>必要なロール</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.pages.map((page) => (
                  <TableRow key={page.pageId}>
                    <TableCell>
                      <PageDialog appId={app.appId} page={page}>
                        <button type="button" className="font-bold text-primary hover:underline">
                          {page.name}
                        </button>
                      </PageDialog>
                    </TableCell>
                    <TableCell className="font-mono">{page.relativePath}</TableCell>
                    <TableCell>{pageRoleLabels[page.role ?? 'all']}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  ));
}

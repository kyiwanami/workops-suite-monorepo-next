import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Button } from '@workops/ui/components/button';
import type { SearchParams } from 'nuqs/server';
import { PageHeader } from '@workops/ui/workops/page-header';
import { AppDialog } from '@/features/apps/components/AppDialog';
import { loadAppSearchParams } from '@/features/apps/search-params';
import { AppList } from '@/features/apps/components/AppList';
import { listApps } from '@/server/apps/data';

// アプリと配下のページの一覧と、登録・編集・削除です。
// 登録・保存・削除して戻ったときの文言です。
const doneMessages = {
  appCreated: 'アプリを登録しました',
  appSaved: 'アプリを保存しました',
  appDeleted: 'アプリを削除しました',
  pageCreated: 'ページを追加しました',
  pageSaved: 'ページを保存しました',
  pageDeleted: 'ページを削除しました',
};

export default async function AppsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { done } = await loadAppSearchParams(searchParams);
  const apps = await listApps();
  return (
    <>
      <PageHeader title="アプリ・ページ">
        <AppDialog app={null}>
          <Button>アプリを登録する</Button>
        </AppDialog>
      </PageHeader>
      {done !== null && (
        <Alert variant="success">
          <AlertTitle>{doneMessages[done]}</AlertTitle>
        </Alert>
      )}
      <AppList apps={apps} />
    </>
  );
}

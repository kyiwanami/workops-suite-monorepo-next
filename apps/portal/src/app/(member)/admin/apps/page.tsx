import { Button } from '@workops/ui/components/button';
import { PageHeader } from '@workops/ui/workops/page-header';
import { AppDialog } from '@/features/apps/components/AppDialog';
import { AppList } from '@/features/apps/components/AppList';
import { listApps } from '@/features/apps/data';

// アプリと配下のページの一覧と、登録・編集・削除です。
export default async function AppsPage() {
  const apps = await listApps();
  return (
    <>
      <PageHeader title="アプリ・ページ">
        <AppDialog app={null}>
          <Button>アプリを登録する</Button>
        </AppDialog>
      </PageHeader>
      <AppList apps={apps} />
    </>
  );
}

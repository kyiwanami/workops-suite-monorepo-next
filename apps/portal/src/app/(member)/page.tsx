import { PageHeader } from '@workops/ui/workops/page-header';
import { AppTiles } from '@/features/home/components/AppTiles';
import { listHomeApps } from '@/features/home/data';

// ホームです。アプリと、ログイン中の利用者が使えるページを並べます。
export default async function HomePage() {
  const apps = await listHomeApps();
  return (
    <>
      <PageHeader title="アプリ" />
      <AppTiles apps={apps} />
    </>
  );
}

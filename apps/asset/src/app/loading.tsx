import { Spinner } from '@workops/ui/components/spinner';

// 画面のデータを読み込んでいる間の表示です。Auroraが自動停止から再開している間もこの表示で待ちます。
export default function Loading() {
  return (
    <main className="mx-auto flex max-w-[1200px] items-center justify-center gap-2 px-4 py-6 text-muted-foreground md:px-6">
      <Spinner />
      読み込んでいます
    </main>
  );
}

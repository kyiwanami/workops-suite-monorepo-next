import { Spinner } from '@workops/ui/components/spinner';

// 画面のデータを読み込んでいる間の表示です。Auroraが自動停止から再開している間もこの表示で待ちます。
// 見つからない・権限がない画面で 404 を返せるよう、一覧の画面にだけ置きます。詳細と作成の画面は、読み込みが終わってから返します。
export function PageLoading() {
  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Spinner />
      読み込んでいます
    </div>
  );
}

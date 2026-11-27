'use client';

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@workops/ui/components/alert';
import { Button } from '@workops/ui/components/button';

// 画面のデータを読めなかったときの表示です。ヘッダーは残し、本文だけを置き換えます。「再試行」で本文を読み直します。
export function PageError({ retry }: { retry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>画面を表示できませんでした</AlertTitle>
      <AlertDescription>時間をおいて、もう一度お試しください。</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={() => retry()}>
          再試行
        </Button>
      </AlertAction>
    </Alert>
  );
}

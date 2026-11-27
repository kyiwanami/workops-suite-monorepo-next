import { Alert, AlertDescription } from '@workops/ui/components/alert';
import type { GlobalError } from 'react-hook-form';

// フォームの送信で、項目に結び付かない失敗を送信ボタンの近くに出します。react-hook-form の root のエラーを渡します。
export function FormFailure({ error }: { error: GlobalError | undefined }) {
  if (error === undefined) {
    return null;
  }
  return (
    <Alert variant="destructive">
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

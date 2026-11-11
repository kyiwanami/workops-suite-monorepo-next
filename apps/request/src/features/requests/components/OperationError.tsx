import { Alert, AlertDescription, AlertTitle } from '@workops/ui/components/alert';
import Link from 'next/link';

// 申請の操作が失敗したときの案内です。失敗した内容と、保存済みの申請を確認するリンクを出します。
// 申請がまだ保存されていなければ、一覧へのリンクにします。
export function OperationError({ title, description, requestId }: { title: string; description: string; requestId: string | null }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{description}</p>
        <Link href={requestId === null ? '/requests' : `/requests/${requestId}`} className="font-bold text-primary hover:underline">
          保存済みの申請を確認
        </Link>
      </AlertDescription>
    </Alert>
  );
}

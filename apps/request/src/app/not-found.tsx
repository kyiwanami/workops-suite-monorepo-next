import { Button } from '@workops/ui/components/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import Link from 'next/link';

// 権限外と存在しないを区別せずに表示し、申請の一覧へ戻します。ほかの部署の申請があるかどうかを推測できないようにするためです。
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>この申請は表示できません</EmptyTitle>
          <EmptyDescription>ほかの部署の申請か、すでに削除された申請です。申請一覧から探し直してください。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/requests">申請一覧へ</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}

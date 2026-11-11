import { Button } from '@workops/ui/components/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import Link from 'next/link';

// 権限外と存在しないを区別せずに表示し、ホームへ戻します。ほかのデータがあるかどうかを推測できないようにするためです。
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>このページは表示できません</EmptyTitle>
          <EmptyDescription>権限がないか、すでに削除されたページです。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">ホームへ戻る</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}

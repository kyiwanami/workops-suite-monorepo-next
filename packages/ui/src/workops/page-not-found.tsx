import { Button } from '@workops/ui/components/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import Link from 'next/link';

// 権限外と存在しないを区別せずに表示し、戻り先へ案内します。ほかの部署のデータがあるかどうかを推測できないようにするためです。
export function PageNotFound({ title, description, href, label }: { title: string; description: string; href: string; label: string }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={href}>{label}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}

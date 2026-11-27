import { Button } from '@workops/ui/components/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import Link from 'next/link';

// 権限外と存在しないを区別せずに表示し、戻り先へ案内します。ほかの部署のデータがあるかどうかを推測できないようにするためです。
// 画面の枠（main）の中に表示します。
export function PageNotFound({ title, description, href, label }: { title: string; description: string; href: string; label: string }) {
  return (
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
  );
}

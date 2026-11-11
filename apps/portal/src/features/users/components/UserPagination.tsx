import { Button } from '@workops/ui/components/button';
import Link from 'next/link';

// ユーザーの一覧のページ送りです。件数の範囲と、前後のページがあるときだけ「前へ」「次へ」を出します。
export function UserPagination({
  total,
  start,
  count,
  page,
  query,
}: {
  total: number;
  start: number;
  count: number;
  page: number;
  query: Record<string, string>;
}) {
  // 今の検索条件を保ったまま、指定したページへ移る URL です。
  const href = (target: number) => `/admin/users?${new URLSearchParams({ ...query, page: String(target) }).toString()}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="font-mono tabular-nums">
        全 {total} 件中 {start + 1}〜{start + count} 件
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Button variant="outline" size="sm" asChild>
            <Link href={href(page - 1)}>前へ</Link>
          </Button>
        )}
        {start + count < total && (
          <Button variant="outline" size="sm" asChild>
            <Link href={href(page + 1)}>次へ</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

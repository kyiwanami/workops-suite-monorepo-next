import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@workops/ui/components/pagination';

// 一覧のページ送りです。件数の範囲と、前後のページがあるときだけ「前へ」「次へ」を出します。
// href は、ページ番号から今の検索条件を保った URL を作ります。
export function ListPagination({ total, start, count, page, href }: { total: number; start: number; count: number; page: number; href: (page: number) => string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="font-mono tabular-nums">
        全 {total} 件中 {start + 1}〜{start + count} 件
      </span>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          {page > 1 && (
            <PaginationItem>
              <PaginationPrevious text="前へ" href={href(page - 1)} />
            </PaginationItem>
          )}
          {start + count < total && (
            <PaginationItem>
              <PaginationNext text="次へ" href={href(page + 1)} />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@workops/ui/components/pagination';
import { serializeUserSearchParams, type UserSearchParams } from '../search-params';

// ユーザーの一覧のページ送りです。件数の範囲と、前後のページがあるときだけ「前へ」「次へ」を出します。今の検索条件を保ったまま移ります。
export function UserPagination({
  total,
  start,
  count,
  params,
}: {
  total: number;
  start: number;
  count: number;
  params: UserSearchParams;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="font-mono tabular-nums">
        全 {total} 件中 {start + 1}〜{start + count} 件
      </span>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          {params.page > 1 && (
            <PaginationItem>
              <PaginationPrevious
                text="前へ"
                href={serializeUserSearchParams('/admin/users', { ...params, page: params.page - 1 })}
              />
            </PaginationItem>
          )}
          {start + count < total && (
            <PaginationItem>
              <PaginationNext text="次へ" href={serializeUserSearchParams('/admin/users', { ...params, page: params.page + 1 })} />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}

import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Button } from '@workops/ui/components/button';
import { PageHeader } from '@workops/ui/workops/page-header';
import { hasRole } from '@workops/server/user';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';
import { RequestFilters } from '@/features/requests/components/RequestFilters';
import { RequestList } from '@/features/requests/components/RequestList';
import { RequestPagination } from '@/features/requests/components/RequestPagination';
import { listDepartmentOptions, listRequests, listRequestTypeOptions } from '@/features/requests/data';
import { loadRequestSearchParams } from '@/features/requests/search-params';
import { getMember } from '@/user';

// 申請の一覧です。タブで「すべて」「自分が承認するもの」「自分の申請」を切り替え、件名・申請者で検索し、種別・期間（全体管理者は部署も）で絞り込みます。
// 申請を保存・操作して戻ったときは、題の下に保存した旨を出します。
export default async function RequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, member] = await Promise.all([loadRequestSearchParams(searchParams), getMember()]);
  const [result, requestTypes, departments] = await Promise.all([
    listRequests(params),
    listRequestTypeOptions(false),
    member.isAdmin ? listDepartmentOptions() : null,
  ]);
  return (
    <>
      <PageHeader
        title={
          <>
            申請
            <span className="ml-3 text-sm font-normal text-muted-foreground">{member.isAdmin ? '全部署' : member.departmentName}</span>
          </>
        }
      >
        {hasRole(member, 'editor') && (
          <Button asChild>
            <Link href="/requests/new">申請を作成</Link>
          </Button>
        )}
      </PageHeader>
      {params.saved === true && (
        <Alert variant="success">
          <AlertTitle>申請を保存しました</AlertTitle>
        </Alert>
      )}
      <RequestFilters canApprove={result.canApprove} counts={result.counts} requestTypes={requestTypes} departments={departments} />
      <RequestList requests={result.requests} showDepartment={member.isAdmin} />
      {result.total > 0 && (
        <RequestPagination
          total={result.total}
          start={result.start}
          count={result.requests.length}
          params={{ ...params, tab: result.tab }}
        />
      )}
    </>
  );
}

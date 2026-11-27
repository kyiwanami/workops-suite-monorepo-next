import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Button } from '@workops/ui/components/button';
import { PageHeader } from '@workops/ui/workops/page-header';
import { hasRole } from '@workops/domain/membership';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';
import { RequestFilters } from '@/features/requests/components/RequestFilters';
import { RequestList } from '@/features/requests/components/RequestList';
import { RequestPagination } from '@/features/requests/components/RequestPagination';
import { listDepartmentOptions, listRequests, listRequestTypeOptions } from '@/server/requests/data';
import { loadRequestSearchParams } from '@/features/requests/search-params';
import { getMember } from '@/server/user';

// 申請の一覧です。タブで「すべて」「自分が承認するもの」「自分の申請」を切り替え、件名・申請者で検索し、種別・期間（全体管理者は部署も）で絞り込みます。
// 申請を保存・操作して戻ったときは、題の下に保存した旨を出します。
// 申請を保存・操作して戻ったときの文言です。
const doneMessages = {
  saved: '申請を保存しました',
  submitted: '申請を提出しました',
  withdrawn: '申請を取り下げました',
  deleted: '申請を削除しました',
  approved: '申請を承認しました',
  rejected: '申請を却下しました',
  returned: '申請を差し戻しました',
};

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
      {params.done !== null && (
        <Alert variant="success">
          <AlertTitle>{doneMessages[params.done]}</AlertTitle>
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

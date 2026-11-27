import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Button } from '@workops/ui/components/button';
import type { SearchParams } from 'nuqs/server';
import { PageHeader } from '@workops/ui/workops/page-header';
import { RequestTypeDialog } from '@/features/request-types/components/RequestTypeDialog';
import { loadRequestTypeSearchParams } from '@/features/request-types/search-params';
import { RequestTypeTable } from '@/features/request-types/components/RequestTypeTable';
import { listRequestTypes } from '@/server/request-types/data';

// 登録・保存・削除して戻ったときの文言です。
const doneMessages = {
  created: '申請種別を登録しました',
  saved: '申請種別を保存しました',
  deleted: '申請種別を削除しました',
};

// 全部署共通の申請種別の一覧と、登録・編集・削除です。承認者以上だけが開けます。
export default async function RequestTypesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { done } = await loadRequestTypeSearchParams(searchParams);
  const requestTypes = await listRequestTypes();
  return (
    <>
      <PageHeader
        title={
          <>
            申請種別<span className="ml-3 text-sm font-normal text-muted-foreground">全部署共通</span>
          </>
        }
      >
        <RequestTypeDialog requestType={null}>
          <Button>種別を登録する</Button>
        </RequestTypeDialog>
      </PageHeader>
      {done !== null && (
        <Alert variant="success">
          <AlertTitle>{doneMessages[done]}</AlertTitle>
        </Alert>
      )}
      <RequestTypeTable requestTypes={requestTypes} />
    </>
  );
}

import { Button } from '@workops/ui/components/button';
import { PageHeader } from '@workops/ui/workops/page-header';
import { RequestTypeDialog } from '@/features/request-types/components/RequestTypeDialog';
import { RequestTypeTable } from '@/features/request-types/components/RequestTypeTable';
import { listRequestTypes } from '@/features/request-types/data';

// 全部署共通の申請種別の一覧と、登録・編集・削除です。承認者以上だけが開けます。
export default async function RequestTypesPage() {
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
      <RequestTypeTable requestTypes={requestTypes} />
    </>
  );
}

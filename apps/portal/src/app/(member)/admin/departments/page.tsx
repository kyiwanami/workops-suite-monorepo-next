import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Button } from '@workops/ui/components/button';
import type { SearchParams } from 'nuqs/server';
import { PageHeader } from '@workops/ui/workops/page-header';
import { DepartmentDialog } from '@/features/departments/components/DepartmentDialog';
import { loadDepartmentSearchParams } from '@/features/departments/search-params';
import { DepartmentTable } from '@/features/departments/components/DepartmentTable';
import { listDepartments } from '@/server/departments/data';

// 登録・保存・削除して戻ったときの文言です。
const doneMessages = {
  created: '部署を登録しました',
  saved: '部署を保存しました',
  deleted: '部署を削除しました',
};

// 部署の一覧と、登録・編集・削除です。
export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { done } = await loadDepartmentSearchParams(searchParams);
  const departments = await listDepartments();
  return (
    <>
      <PageHeader title="部署">
        <DepartmentDialog department={null}>
          <Button>部署を登録する</Button>
        </DepartmentDialog>
      </PageHeader>
      {done !== null && (
        <Alert variant="success">
          <AlertTitle>{doneMessages[done]}</AlertTitle>
        </Alert>
      )}
      <DepartmentTable departments={departments} />
    </>
  );
}

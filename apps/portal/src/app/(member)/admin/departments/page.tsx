import { Button } from '@workops/ui/components/button';
import { PageHeader } from '@workops/ui/workops/page-header';
import { DepartmentDialog } from '@/features/departments/components/DepartmentDialog';
import { DepartmentTable } from '@/features/departments/components/DepartmentTable';
import { listDepartments } from '@/features/departments/data';

// 部署の一覧と、登録・編集・削除です。
export default async function DepartmentsPage() {
  const departments = await listDepartments();
  return (
    <>
      <PageHeader title="部署">
        <DepartmentDialog department={null}>
          <Button>部署を登録する</Button>
        </DepartmentDialog>
      </PageHeader>
      <DepartmentTable departments={departments} />
    </>
  );
}

import { DepartmentForm } from '@/features/departments/components/DepartmentForm';
import { DepartmentTable } from '@/features/departments/components/DepartmentTable';
import { listDepartments } from '@/features/departments/data';

// 部署の一覧と登録です。
export default async function DepartmentsPage() {
  const departments = await listDepartments();
  return (
    <main>
      <h1>部署</h1>
      <DepartmentForm />
      <DepartmentTable departments={departments} />
    </main>
  );
}

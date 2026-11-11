import { CreateUser } from '@/features/users/components/CreateUser';
import { UserFilters } from '@/features/users/components/UserFilters';
import { UserPagination } from '@/features/users/components/UserPagination';
import { UserTable } from '@/features/users/components/UserTable';
import { listDepartmentOptions, listUsers } from '@/features/users/data';

// ユーザーの一覧です。名前・メールで検索し、部署と状態で絞り込みます。
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const conditions = { q: params.q ?? '', departmentId: params.department ?? '', status: params.status ?? '', page };
  const [departments, result] = await Promise.all([listDepartmentOptions(), listUsers(conditions)]);
  // ページ送りのリンクに引き継ぐ検索条件です。
  const query = Object.fromEntries(
    Object.entries({ q: conditions.q, department: conditions.departmentId, status: conditions.status }).filter(
      ([, value]) => value !== '',
    ),
  );
  return (
    <>
      <CreateUser departments={departments} />
      <UserFilters departments={departments} />
      <UserTable users={result.users} />
      {result.total > 0 && (
        <UserPagination total={result.total} start={result.start} count={result.users.length} page={page} query={query} />
      )}
    </>
  );
}

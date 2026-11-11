import type { SearchParams } from 'nuqs/server';
import { CreateUser } from '@/features/users/components/CreateUser';
import { UserFilters } from '@/features/users/components/UserFilters';
import { UserPagination } from '@/features/users/components/UserPagination';
import { UserTable } from '@/features/users/components/UserTable';
import { listDepartmentOptions, listUsers } from '@/features/users/data';
import { loadUserSearchParams } from '@/features/users/search-params';

// ユーザーの一覧です。名前・メールで検索し、部署と状態で絞り込みます。
export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await loadUserSearchParams(searchParams);
  const [departments, result] = await Promise.all([listDepartmentOptions(), listUsers(params)]);
  return (
    <>
      <CreateUser departments={departments} />
      <UserFilters departments={departments} />
      <UserTable users={result.users} />
      {result.total > 0 && (
        <UserPagination total={result.total} start={result.start} count={result.users.length} params={params} />
      )}
    </>
  );
}

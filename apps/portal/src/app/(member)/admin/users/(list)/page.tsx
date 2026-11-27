import { Alert, AlertTitle } from '@workops/ui/components/alert';
import type { SearchParams } from 'nuqs/server';
import { CreateUser } from '@/features/users/components/CreateUser';
import { UserFilters } from '@/features/users/components/UserFilters';
import { UserTable } from '@/features/users/components/UserTable';
import { listDepartmentOptions, listUsers } from '@/server/users/data';
import { loadUserSearchParams, serializeUserSearchParams } from '@/features/users/search-params';
import { ListPagination } from '@workops/ui/workops/list-pagination';

// ユーザーの一覧です。名前・メールで検索し、部署と状態で絞り込みます。
export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await loadUserSearchParams(searchParams);
  const [departments, result] = await Promise.all([listDepartmentOptions(), listUsers(params)]);
  return (
    <>
      <CreateUser departments={departments} />
      {params.done === 'deleted' && (
        <Alert variant="success">
          <AlertTitle>ユーザーを削除しました</AlertTitle>
        </Alert>
      )}
      <UserFilters departments={departments} />
      <UserTable users={result.users} />
      {result.total > 0 && (
        <ListPagination
          total={result.total}
          start={result.start}
          count={result.users.length}
          page={params.page}
          href={(page) => serializeUserSearchParams('/admin/users', { ...params, page, done: null })}
        />
      )}
    </>
  );
}

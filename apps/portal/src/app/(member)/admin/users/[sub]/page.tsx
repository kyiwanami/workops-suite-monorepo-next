import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@workops/ui/components/card';
import { formatDateTime } from '@workops/ui/lib/labels';
import { PageBreadcrumb } from '@workops/ui/workops/page-breadcrumb';
import type { SearchParams } from 'nuqs/server';
import { AccountActions } from '@/features/users/components/AccountActions';
import { MembershipForm } from '@/features/users/components/MembershipForm';
import { getUser, listDepartmentOptions } from '@/server/users/data';
import { loadUserDetailSearchParams } from '@/features/users/search-params';

// 有効・無効にして戻ったときの文言です。
const doneMessages = { enabled: 'ユーザーを有効にしました', disabled: 'ユーザーを無効にしました' };

// ユーザーの詳細です。状態の表示とアカウントの操作、所属の保存、アカウントの情報を並べます。
export default async function UserPage({ params, searchParams }: { params: Promise<{ sub: string }>; searchParams: Promise<SearchParams> }) {
  const [{ sub }, { done }] = await Promise.all([params, loadUserDetailSearchParams(searchParams)]);
  const [user, departments] = await Promise.all([getUser(sub), listDepartmentOptions()]);
  const displayName = user.name ?? user.email;
  return (
    <>
      <PageBreadcrumb href="/admin/users" label="ユーザー">
        {displayName}
      </PageBreadcrumb>
      <AccountActions
        sub={user.sub}
        email={user.email}
        displayName={displayName}
        status={user.status}
      />
      {done !== null && (
        <Alert variant="success">
          <AlertTitle>{doneMessages[done]}</AlertTitle>
        </Alert>
      )}
      <MembershipForm sub={user.sub} departments={departments} membership={user.membership} />
      <Card>
        <CardHeader>
          <CardTitle>アカウント</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted-foreground">メール</dt>
            <dd>{user.email}</dd>
            <dt className="text-muted-foreground">招待日時</dt>
            <dd className="font-mono tabular-nums">{user.invitedAt && formatDateTime(user.invitedAt)}</dd>
          </dl>
          {user.status !== 'disabled' && <p className="text-muted-foreground">削除は、無効にした後に表示されます</p>}
        </CardContent>
      </Card>
    </>
  );
}

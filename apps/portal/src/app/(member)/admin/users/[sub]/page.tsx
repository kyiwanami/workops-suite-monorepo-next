import { Badge } from '@workops/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@workops/ui/components/card';
import Link from 'next/link';
import { AccountActions } from '@/features/users/components/AccountActions';
import { MembershipForm } from '@/features/users/components/MembershipForm';
import { getUser, listDepartmentOptions } from '@/features/users/data';
import { statusBadges } from '@/features/users/labels';

// 日時を「2026/11/10 14:30」の形にします。
const dateTimeFormat = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

// ユーザーの詳細です。状態の表示とアカウントの操作、所属の保存、アカウントの情報を並べます。
export default async function UserPage({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const [user, departments] = await Promise.all([getUser(sub), listDepartmentOptions()]);
  const displayName = user.name ?? user.email;
  const badge = statusBadges[user.status];
  return (
    <>
      <nav className="text-sm text-muted-foreground">
        <Link href="/admin/users" className="font-bold text-primary hover:underline">
          ユーザー
        </Link>
        {' ／ '}
        {displayName}
      </nav>
      <AccountActions
        sub={user.sub}
        email={user.email}
        displayName={displayName}
        status={user.status}
        badge={<Badge variant={badge.variant}>{badge.label}</Badge>}
      />
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
            <dd className="font-mono tabular-nums">{user.invitedAt && dateTimeFormat.format(user.invitedAt)}</dd>
          </dl>
          {user.status !== 'disabled' && <p className="text-muted-foreground">削除は、無効にした後に表示されます</p>}
        </CardContent>
      </Card>
    </>
  );
}

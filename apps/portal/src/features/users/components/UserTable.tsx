import { Badge } from '@workops/ui/components/badge';
import { Empty, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workops/ui/components/table';
import Link from 'next/link';
import type { UserRow } from '../data';
import { roleLabels } from '@workops/ui/lib/roles';
import { statusBadges } from '../labels';

// ユーザーの一覧表です。名前（未設定ならメール）を押すと詳細を開きます。
// 所属が未設定の利用者は、部署の列で目立たせます。狭い画面ではメールとロールの列を隠します。
export function UserTable({ users }: { users: UserRow[] }) {
  if (users.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>該当するユーザーはいません</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名前</TableHead>
            <TableHead className="hidden md:table-cell">メール</TableHead>
            <TableHead>部署</TableHead>
            <TableHead className="hidden md:table-cell">ロール</TableHead>
            <TableHead>アカウント</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.sub}>
              <TableCell className="whitespace-normal break-all">
                <Link href={`/admin/users/${user.sub}`} className="font-bold text-primary hover:underline">
                  {user.name ?? user.email}
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">{user.email}</TableCell>
              <TableCell>
                {user.membership === null ? (
                  <span className="font-bold text-warning">所属が未設定</span>
                ) : (
                  user.membership.departmentName
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {user.membership !== null && (user.membership.isAdmin ? '全体管理者' : roleLabels[user.membership.role])}
              </TableCell>
              <TableCell>
                <Badge variant={statusBadges[user.status].variant}>{statusBadges[user.status].label}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

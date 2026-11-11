import { Badge } from '@workops/ui/components/badge';
import { Card, CardContent } from '@workops/ui/components/card';
import { Empty, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workops/ui/components/table';
import Link from 'next/link';
import type { RequestRow } from '../data';
import { formatAmount, formatDateTime, statusBadges } from '../labels';

// 提出日時の表示です。未提出は「—」です。
const submittedAt = (item: RequestRow) => (item.submittedAt === null ? '—' : formatDateTime(item.submittedAt));

// 申請の一覧です。広い画面は表、狭い画面は Card を並べます。件名を押すと詳細を開き、狭い画面ではカード全体が詳細へのリンクです。
// 全体管理者には部署を出します。
export function RequestList({ requests, showDepartment }: { requests: RequestRow[]; showDepartment: boolean }) {
  if (requests.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>条件に合う申請はありません</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>件名</TableHead>
              {showDepartment && <TableHead>部署</TableHead>}
              <TableHead>種別</TableHead>
              <TableHead>申請者</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>提出日時</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-normal">
                  <Link href={`/requests/${item.id}`} className="font-bold text-primary hover:underline">
                    {item.title}
                  </Link>
                </TableCell>
                {showDepartment && <TableCell>{item.departmentName}</TableCell>}
                <TableCell>{item.requestTypeName}</TableCell>
                <TableCell>{item.requesterName}</TableCell>
                <TableCell>
                  <Badge variant={statusBadges[item.status].variant}>{statusBadges[item.status].label}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatAmount(item.amount)}</TableCell>
                <TableCell className="font-mono tabular-nums">{submittedAt(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 md:hidden">
        {requests.map((item) => (
          <Link key={item.id} href={`/requests/${item.id}`}>
            <Card className="py-4">
              <CardContent className="grid gap-2 px-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-bold text-primary">{item.title}</span>
                  <Badge variant={statusBadges[item.status].variant}>{statusBadges[item.status].label}</Badge>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    {[showDepartment ? item.departmentName : null, item.requesterName, formatAmount(item.amount)]
                      .filter((text) => text !== null)
                      .join('・')}
                  </span>
                  <span className="font-mono tabular-nums">{submittedAt(item)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

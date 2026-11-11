import { Badge } from '@workops/ui/components/badge';
import { Empty, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workops/ui/components/table';
import type { RequestTypeRow } from '../data';
import { RequestTypeDialog } from './RequestTypeDialog';

// 申請種別の一覧表です。種別名を押すと編集のダイアログが開きます。有効区分は表示だけです。
export function RequestTypeTable({ requestTypes }: { requestTypes: RequestTypeRow[] }) {
  if (requestTypes.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>申請種別はまだありません</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">表示順</TableHead>
            <TableHead>コード</TableHead>
            <TableHead>種別名</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">使用中の申請</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requestTypes.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-right font-mono tabular-nums">{item.sortOrder}</TableCell>
              <TableCell className="font-mono">{item.code}</TableCell>
              <TableCell>
                <RequestTypeDialog requestType={item}>
                  <button type="button" className="font-bold text-primary hover:underline">
                    {item.name}
                  </button>
                </RequestTypeDialog>
              </TableCell>
              <TableCell>
                <Badge variant={item.isActive ? 'success' : 'outline'}>{item.isActive ? '有効' : '無効'}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{item.requestCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

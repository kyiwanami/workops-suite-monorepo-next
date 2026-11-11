import { Empty, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workops/ui/components/table';
import type { listDepartments } from '../data';
import { DepartmentDialog } from './DepartmentDialog';

// 部署の一覧表です。部署名を押すと編集のダイアログが開きます。
export function DepartmentTable({ departments }: { departments: Awaited<ReturnType<typeof listDepartments>> }) {
  if (departments.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>部署はまだありません</EmptyTitle>
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
            <TableHead>部署コード</TableHead>
            <TableHead>部署名</TableHead>
            <TableHead className="text-right">所属人数</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {departments.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-right font-mono tabular-nums">{item.sortOrder}</TableCell>
              <TableCell className="font-mono">{item.code}</TableCell>
              <TableCell>
                <DepartmentDialog department={item}>
                  <button type="button" className="font-bold text-primary hover:underline">
                    {item.name}
                  </button>
                </DepartmentDialog>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{item.memberCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

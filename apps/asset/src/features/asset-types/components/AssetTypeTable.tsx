import { Empty, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workops/ui/components/table';
import type { AssetTypeRow } from '../data';
import { AssetTypeDialog } from './AssetTypeDialog';

// 資産種別の一覧表です。種別名を押すと編集のダイアログが開きます。
export function AssetTypeTable({ assetTypes }: { assetTypes: AssetTypeRow[] }) {
  if (assetTypes.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>資産種別はまだありません</EmptyTitle>
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
            <TableHead className="hidden md:table-cell">説明</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assetTypes.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-right font-mono tabular-nums">{item.sortOrder}</TableCell>
              <TableCell className="font-mono">{item.code}</TableCell>
              <TableCell>
                <AssetTypeDialog assetType={item}>
                  <button type="button" className="font-bold text-primary hover:underline">
                    {item.name}
                  </button>
                </AssetTypeDialog>
              </TableCell>
              <TableCell className="hidden whitespace-normal text-muted-foreground md:table-cell">{item.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

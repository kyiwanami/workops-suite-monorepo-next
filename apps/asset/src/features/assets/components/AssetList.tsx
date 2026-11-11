'use client';

import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Card, CardContent } from '@workops/ui/components/card';
import { Empty, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workops/ui/components/table';
import Link from 'next/link';
import { type ReactNode, useState, useTransition } from 'react';
import { changeStatusAction } from '../actions';
import type { AssetRow } from '../data';
import { formatDateTime, statusBadges } from '../labels';
import { StatusMenu } from './StatusMenu';

// 資産の一覧です。広い画面は表、狭い画面は Card を並べます。名称を押すと詳細を開きます。
// 変更できる人は状態のバッジから状態を選んで即時に保存でき、変えた内容を一覧の上に出します。全体管理者には部署を出します。
export function AssetList({
  assets,
  editable,
  showDepartment,
  filters,
}: {
  assets: AssetRow[];
  editable: boolean;
  showDepartment: boolean;
  filters: ReactNode;
}) {
  const [changed, setChanged] = useState<Awaited<ReturnType<typeof changeStatusAction>> | null>(null);
  const [pending, startTransition] = useTransition();
  // 状態を保存し、変えた内容を出します。
  const change = (id: string, status: AssetRow['status']) =>
    startTransition(async () => {
      setChanged(await changeStatusAction(id, status));
    });
  // 状態のバッジです。
  const statusMenu = (item: AssetRow) => (
    <StatusMenu
      status={item.status}
      editable={editable}
      disabled={pending}
      onChange={(status) => change(item.id, status)}
    />
  );
  return (
    <>
      {changed !== null && (
        <Alert variant="success">
          <AlertTitle>
            状態を{statusBadges[changed.from].label}から{statusBadges[changed.to].label}に変更しました
          </AlertTitle>
        </Alert>
      )}
      {filters}
      {assets.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>該当する資産はありません</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  {showDepartment && <TableHead>部署</TableHead>}
                  <TableHead>種別</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>担当者</TableHead>
                  <TableHead>更新日時</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-normal">
                      <Link href={`/assets/${item.id}`} className="font-bold text-primary hover:underline">
                        {item.name}
                      </Link>
                    </TableCell>
                    {showDepartment && <TableCell>{item.departmentName}</TableCell>}
                    <TableCell>{item.assetTypeName}</TableCell>
                    <TableCell>{statusMenu(item)}</TableCell>
                    <TableCell className={item.assigneeName === null ? 'text-muted-foreground' : undefined}>
                      {item.assigneeName ?? '未割当'}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">{formatDateTime(item.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 md:hidden">
            {assets.map((item) => (
              <Card key={item.id} className="py-4">
                <CardContent className="grid gap-2 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/assets/${item.id}`} className="font-bold text-primary hover:underline">
                      {item.name}
                    </Link>
                    {statusMenu(item)}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {showDepartment && <span>{item.departmentName}</span>}
                    <span>{item.assetTypeName}</span>
                    <span>{item.assigneeName ?? '未割当'}</span>
                    <span className="font-mono tabular-nums">{formatDateTime(item.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

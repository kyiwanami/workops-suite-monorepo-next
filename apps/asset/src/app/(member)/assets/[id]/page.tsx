import { Badge } from '@workops/ui/components/badge';
import { Card, CardContent } from '@workops/ui/components/card';
import { ConfirmButton } from '@workops/ui/workops/confirm-button';
import { PageHeader } from '@workops/ui/workops/page-header';
import { hasRole } from '@workops/server/user';
import Link from 'next/link';
import { deleteAssetAction } from '@/features/assets/actions';
import { AssetForm } from '@/features/assets/components/AssetForm';
import { getAsset, listAssetTypeOptions, listMembers } from '@/features/assets/data';
import { formatDateTime, statusBadges } from '@/features/assets/labels';
import { getMember } from '@/user';

// 資産の詳細です。編集できる人には最初から入力欄で、閲覧者には読み取り専用で出します。削除は承認者以上だけに出します。
export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [member, asset] = await Promise.all([getMember(), getAsset(id)]);
  const badge = statusBadges[asset.status];
  const editable = hasRole(member, 'editor');
  const [assetTypes, members] = editable
    ? await Promise.all([listAssetTypeOptions(), listMembers([asset.departmentId])])
    : [[], []];
  return (
    <>
      <nav className="text-sm text-muted-foreground">
        <Link href="/assets" className="font-bold text-primary hover:underline">
          資産
        </Link>
        {' ／ '}
        {asset.name}
      </nav>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {asset.name}
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </span>
        }
      >
        {hasRole(member, 'manager') && (
          <ConfirmButton
            label="削除する"
            title={`資産「${asset.name}」を削除しますか？`}
            description="削除した資産は元に戻せません。"
            pendingLabel="削除しています"
            destructive
            fields={{ id: asset.id }}
            action={deleteAssetAction}
          />
        )}
      </PageHeader>
      {editable ? (
        <AssetForm
          asset={asset}
          departmentId={asset.departmentId}
          departments={null}
          assetTypes={assetTypes}
          members={members}
        />
      ) : (
        <Card>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">種別</dt>
              <dd>{asset.assetTypeName}</dd>
              <dt className="text-muted-foreground">状態</dt>
              <dd>{badge.label}</dd>
              <dt className="text-muted-foreground">担当者</dt>
              <dd>{asset.assigneeName ?? '未割当'}</dd>
              <dt className="text-muted-foreground">更新日時</dt>
              <dd className="font-mono tabular-nums">{formatDateTime(asset.updatedAt)}</dd>
            </dl>
          </CardContent>
        </Card>
      )}
    </>
  );
}

import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Button } from '@workops/ui/components/button';
import { ListPagination } from '@workops/ui/workops/list-pagination';
import { PageHeader } from '@workops/ui/workops/page-header';
import { hasRole } from '@workops/domain/membership';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';
import { AssetFilters } from '@/features/assets/components/AssetFilters';
import { AssetList } from '@/features/assets/components/AssetList';
import { listAssets, listAssetTypeOptions, listDepartmentOptions } from '@/server/assets/data';
import { loadAssetSearchParams, serializeAssetSearchParams } from '@/features/assets/search-params';
import { getMember } from '@/server/user';

// 保存・削除して戻ったときの文言です。
const doneMessages = { saved: '資産を保存しました', deleted: '資産を削除しました' };

// 資産の一覧です。名称・担当者で検索し、状態・種別（全体管理者は部署も）で絞り込みます。
// 資産を保存・削除して戻ったときは、題の下にその旨を出します。
export default async function AssetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, member] = await Promise.all([loadAssetSearchParams(searchParams), getMember()]);
  const [result, assetTypes, departments] = await Promise.all([
    listAssets(params),
    listAssetTypeOptions(),
    member.isAdmin ? listDepartmentOptions() : null,
  ]);
  return (
    <>
      <PageHeader
        title={
          <>
            資産
            <span className="ml-3 text-sm font-normal text-muted-foreground">
              {member.isAdmin ? '全部署' : member.departmentName} ／ 全 {result.total} 件
            </span>
          </>
        }
      >
        {hasRole(member, 'editor') && (
          <Button asChild>
            <Link href="/assets/new">資産を登録する</Link>
          </Button>
        )}
      </PageHeader>
      {params.done !== null && (
        <Alert variant="success">
          <AlertTitle>{doneMessages[params.done]}</AlertTitle>
        </Alert>
      )}
      <AssetList
        assets={result.assets}
        editable={hasRole(member, 'editor')}
        showDepartment={member.isAdmin}
        filters={<AssetFilters assetTypes={assetTypes} departments={departments} />}
      />
      {result.total > 0 && (
        <ListPagination
          total={result.total}
          start={result.start}
          count={result.assets.length}
          page={params.page}
          href={(page) => serializeAssetSearchParams('/assets', { ...params, page, done: null })}
        />
      )}
    </>
  );
}

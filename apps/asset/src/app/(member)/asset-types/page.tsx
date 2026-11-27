import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Button } from '@workops/ui/components/button';
import type { SearchParams } from 'nuqs/server';
import { PageHeader } from '@workops/ui/workops/page-header';
import { AssetTypeDialog } from '@/features/asset-types/components/AssetTypeDialog';
import { loadAssetTypeSearchParams } from '@/features/asset-types/search-params';
import { AssetTypeTable } from '@/features/asset-types/components/AssetTypeTable';
import { listAssetTypes } from '@/server/asset-types/data';

// 全部署共通の資産種別の一覧と、登録・編集・削除です。承認者以上だけが開けます。
// 登録・保存・削除して戻ったときの文言です。
const doneMessages = {
  created: '資産種別を登録しました',
  saved: '資産種別を保存しました',
  deleted: '資産種別を削除しました',
};

export default async function AssetTypesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { done } = await loadAssetTypeSearchParams(searchParams);
  const assetTypes = await listAssetTypes();
  return (
    <>
      <PageHeader
        title={
          <>
            資産種別<span className="ml-3 text-sm font-normal text-muted-foreground">全部署共通</span>
          </>
        }
      >
        <AssetTypeDialog assetType={null}>
          <Button>種別を登録する</Button>
        </AssetTypeDialog>
      </PageHeader>
      {done !== null && (
        <Alert variant="success">
          <AlertTitle>{doneMessages[done]}</AlertTitle>
        </Alert>
      )}
      <AssetTypeTable assetTypes={assetTypes} />
    </>
  );
}

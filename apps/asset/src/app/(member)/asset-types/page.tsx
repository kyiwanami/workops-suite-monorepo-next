import { Button } from '@workops/ui/components/button';
import { PageHeader } from '@workops/ui/workops/page-header';
import { AssetTypeDialog } from '@/features/asset-types/components/AssetTypeDialog';
import { AssetTypeTable } from '@/features/asset-types/components/AssetTypeTable';
import { listAssetTypes } from '@/features/asset-types/data';

// 全部署共通の資産種別の一覧と、登録・編集・削除です。承認者以上だけが開けます。
export default async function AssetTypesPage() {
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
      <AssetTypeTable assetTypes={assetTypes} />
    </>
  );
}

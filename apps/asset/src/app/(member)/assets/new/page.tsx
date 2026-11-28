import { PageBreadcrumb } from '@workops/ui/workops/page-breadcrumb';
import { PageHeader } from '@workops/ui/workops/page-header';
import { hasRole } from '@workops/domain/membership';
import { notFound } from 'next/navigation';
import { AssetForm } from '@/features/assets/components/AssetForm';
import { listAssetTypeOptions, listDepartmentOptions, listMembers } from '@/server/assets/data';
import { getMember } from '@/server/user';

// 資産の登録です。編集者以上だけが開けます。全体管理者は登録する部署を選び、それ以外は自部署に登録します。
export default async function NewAssetPage() {
  const member = await getMember();
  if (!hasRole(member, 'editor')) {
    notFound();
  }
  const [assetTypes, departments, members] = await Promise.all([
    listAssetTypeOptions(),
    member.isAdmin ? listDepartmentOptions() : null,
    listMembers(null),
  ]);
  return (
    <>
      <PageBreadcrumb href="/assets" label="資産">
        登録
      </PageBreadcrumb>
      <PageHeader title="資産を登録する" />
      <AssetForm
        asset={null}
        departmentId={departments === null ? member.departmentId : ''}
        departments={departments}
        assetTypes={assetTypes}
        members={members}
      />
    </>
  );
}

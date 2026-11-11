import { PageHeader } from '@workops/ui/workops/page-header';
import { hasRole } from '@workops/server/user';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AssetForm } from '@/features/assets/components/AssetForm';
import { listAssetTypeOptions, listDepartmentOptions, listMembers } from '@/features/assets/data';
import { getMember } from '@/user';

// 資産の登録です。編集者以上だけが開けます。全体管理者は登録する部署を選び、それ以外は自部署に登録します。
export default async function NewAssetPage() {
  const member = await getMember();
  if (!hasRole(member, 'editor')) {
    notFound();
  }
  const [assetTypes, departments] = await Promise.all([
    listAssetTypeOptions(),
    member.isAdmin ? listDepartmentOptions() : null,
  ]);
  const members = await listMembers(departments === null ? [member.departmentId] : departments.map((item) => item.id));
  return (
    <>
      <nav className="text-sm text-muted-foreground">
        <Link href="/assets" className="font-bold text-primary hover:underline">
          資産
        </Link>
        {' ／ '}
        登録
      </nav>
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

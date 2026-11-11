import { Badge } from '@workops/ui/components/badge';
import { PageHeader } from '@workops/ui/workops/page-header';
import { hasRole } from '@workops/server/user';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RequestForm } from '@/features/requests/components/RequestForm';
import { listRequestTypeOptions } from '@/features/requests/data';
import { statusBadges } from '@/features/requests/labels';
import { getMember } from '@/user';

// 申請の作成です。担当者以上だけが開けます。種別は有効なものだけを選べます。
export default async function NewRequestPage() {
  const member = await getMember();
  if (!hasRole(member, 'editor')) {
    notFound();
  }
  const requestTypes = await listRequestTypeOptions(true);
  return (
    <div className="grid gap-6 max-md:pb-20">
      <nav className="text-sm text-muted-foreground">
        <Link href="/requests" className="font-bold text-primary hover:underline">
          申請
        </Link>
        {' ／ '}新しい申請
      </nav>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            申請を作成
            <Badge variant={statusBadges.draft.variant}>{statusBadges.draft.label}</Badge>
          </span>
        }
      />
      <RequestForm request={null} requestTypes={requestTypes} resubmit={false} />
    </div>
  );
}

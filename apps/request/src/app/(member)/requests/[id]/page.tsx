import { getOperations } from '@workops/domain/requests';
import { Alert, AlertDescription, AlertTitle } from '@workops/ui/components/alert';
import { Badge } from '@workops/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@workops/ui/components/card';
import { ConfirmButton } from '@workops/ui/workops/confirm-button';
import { PageHeader } from '@workops/ui/workops/page-header';
import { CircleX, CornerUpLeft } from 'lucide-react';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';
import { approveRequestAction, deleteRequestAction, withdrawRequestAction } from '@/server/requests/actions';
import { ActionBar } from '@/features/requests/components/ActionBar';
import { ReasonDialog } from '@/features/requests/components/ReasonDialog';
import { loadRequestDetailSearchParams } from '@/features/requests/search-params';
import { RequestForm } from '@/features/requests/components/RequestForm';
import { getRequest, listRequestTypeOptions } from '@/server/requests/data';
import { formatAmount, formatDateTime, requestStatusBadges } from '@workops/ui/lib/labels';
import { getMember } from '@/server/user';

// 申請の詳細です。状態・ロール・本人条件に応じて操作を出し分けます。
// 本人の下書きは入力欄で出し、その場で直して提出できます。承認者には他者の提出済みの申請に「却下」「差戻し」「承認」を出します。
// 差し戻された下書きと却下された申請には、理由と日時を上部に出します。経過は申請の日時の項目から出します。
// 申請の今の状態で操作できずに戻ったときは、操作の近くにその旨を出します。
export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ id }, { failed }] = await Promise.all([params, loadRequestDetailSearchParams(searchParams)]);
  const [member, request] = await Promise.all([getMember(), getRequest(id)]);
  const operations = getOperations(member, request);
  const requestTypes = operations.update ? await listRequestTypeOptions(true) : [];
  const badge = requestStatusBadges[request.status];
  // 経過です。値のある日時だけを、時刻の順に並べます。
  const history = [
    { label: '作成', at: request.createdAt },
    { label: '提出', at: request.submittedAt },
    { label: '差戻し', at: request.returnedAt },
    { label: '承認', at: request.approvedAt },
    { label: '却下', at: request.rejectedAt },
    { label: '取下げ', at: request.withdrawnAt },
  ]
    .flatMap((item) => (item.at === null ? [] : [{ label: item.label, at: item.at }]))
    .sort((a, b) => a.at.localeCompare(b.at));
  return (
    <div className="grid gap-6 max-md:pb-20">
      <nav className="text-sm text-muted-foreground">
        <Link href="/requests" className="font-bold text-primary hover:underline">
          申請
        </Link>
        {' ／ '}
        {request.title}
      </nav>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {request.title}
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </span>
        }
      >
        {(operations.withdraw || operations.delete) && (
          <div className="flex gap-2">
            {operations.withdraw && (
              <ConfirmButton
                label="取下げ"
                title="この申請を取り下げますか？"
                description="取り下げた申請は元に戻せません。"
                pendingLabel="取り下げています"
                destructive={false}
                fields={{ id: request.id }}
                action={withdrawRequestAction}
              />
            )}
            {operations.delete && (
              <ConfirmButton
                label="削除"
                title="この下書きを削除しますか？"
                description="削除した申請は元に戻せません。"
                pendingLabel="削除しています"
                destructive
                fields={{ id: request.id }}
                action={deleteRequestAction}
              />
            )}
          </div>
        )}
      </PageHeader>
      {failed === true && (
        <Alert variant="destructive">
          <AlertTitle>操作できませんでした</AlertTitle>
          <AlertDescription>ほかの操作で申請の状態が変わっていました。最新の状態を表示しています。</AlertDescription>
        </Alert>
      )}
      {request.status === 'draft' && request.returnedAt !== null && (
        <Alert variant="warning">
          <CornerUpLeft />
          <AlertTitle>
            差し戻されています（<span className="font-mono tabular-nums">{formatDateTime(request.returnedAt)}</span>）
          </AlertTitle>
          <AlertDescription>理由：{request.returnReason}。修正して再提出できます。</AlertDescription>
        </Alert>
      )}
      {request.status === 'rejected' && request.rejectedAt !== null && (
        <Alert variant="destructive">
          <CircleX />
          <AlertTitle>
            却下されました（<span className="font-mono tabular-nums">{formatDateTime(request.rejectedAt)}</span>）
          </AlertTitle>
          <AlertDescription>理由：{request.rejectionReason}</AlertDescription>
        </Alert>
      )}
      {operations.update ? (
        <RequestForm request={request} requestTypes={requestTypes} resubmit={request.returnedAt !== null} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>申請の内容</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">申請者</dt>
              <dd>
                {request.requesterName}（{request.departmentName}）
              </dd>
              <dt className="text-muted-foreground">種別</dt>
              <dd>{request.requestTypeName}</dd>
              <dt className="text-muted-foreground">金額</dt>
              <dd className="font-mono tabular-nums">{formatAmount(request.amount)}</dd>
              <dt className="text-muted-foreground">説明</dt>
              <dd className="whitespace-pre-wrap">{request.description}</dd>
            </dl>
          </CardContent>
        </Card>
      )}
      {operations.approve && (
        <ActionBar>
          <ReasonDialog requestId={request.id} requesterName={request.requesterName} kind="reject" />
          <ReasonDialog requestId={request.id} requesterName={request.requesterName} kind="return" />
          <ConfirmButton
            label="承認"
            title="この申請を承認しますか？"
            description={`「${request.title}」${formatAmount(request.amount)} を承認します。承認した申請は元に戻せません。`}
            pendingLabel="承認しています"
            destructive={false}
            fields={{ id: request.id }}
            action={approveRequestAction}
            primary
          />
        </ActionBar>
      )}
      <Card>
        <CardHeader>
          <CardTitle>経過</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {history.map((item) => (
              <div key={item.label} className="contents">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-mono tabular-nums">{formatDateTime(item.at)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { Alert, AlertDescription, AlertTitle } from '@workops/ui/components/alert';
import { ConfirmButton } from '@workops/ui/workops/confirm-button';
import { Button } from '@workops/ui/components/button';
import { Spinner } from '@workops/ui/components/spinner';
import { unstable_rethrow } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { useActionState } from 'react';
import { deleteUserAction, disableUserAction, enableUserAction, resendInvitationAction } from '@/server/users/actions';
import { Badge } from '@workops/ui/components/badge';
import { statusBadges } from '../labels';
import type { AccountStatus } from '../schema';
import { userDetailSearchParams } from '../search-params';

// ユーザーの詳細の題と、状態に合わせたアカウントの操作です。
// 招待メールの再送は招待中だけ、削除は無効にした後だけ出します。
export function AccountActions({
  sub,
  email,
  displayName,
  status,
}: {
  sub: string;
  email: string;
  displayName: string;
  status: AccountStatus;
}) {
  const [, setParams] = useQueryStates(userDetailSearchParams, { shallow: false });
  // 招待メールを再送し、結果を返します。
  const [resent, resend, resending] = useActionState<'sent' | 'failed' | null>(async () => {
    // 前の操作の結果の表示は消す
    void setParams({ done: null });
    try {
      await resendInvitationAction(email);
      return 'sent';
    } catch (error) {
      unstable_rethrow(error);
      console.error(error);
      return 'failed';
    }
  }, null);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <Badge variant={statusBadges[status].variant}>{statusBadges[status].label}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'invited' && (
            <form action={resend}>
              <Button type="submit" variant="outline" disabled={resending}>
                {resending && <Spinner />}
                {resending ? '再送しています' : '招待メールを再送する'}
              </Button>
            </form>
          )}
          {status === 'disabled' ? (
            <>
              <ConfirmButton
                label="有効にする"
                title={`${displayName}さんを有効にしますか？`}
                description="有効にすると、このユーザーはログインできるようになります。"
                pendingLabel="有効にしています"
                destructive={false}
                fields={{ sub }}
                action={enableUserAction}
              />
              <ConfirmButton
                label="削除する"
                title={`${displayName}さんを削除しますか？`}
                description="削除したユーザーは元に戻せません。"
                pendingLabel="削除しています"
                destructive
                fields={{ sub }}
                action={deleteUserAction}
              />
            </>
          ) : (
            <ConfirmButton
              label="無効にする"
              title={`${displayName}さんを無効にしますか？`}
              description="無効にすると、このユーザーはログインできなくなります。"
              pendingLabel="無効にしています"
              destructive={false}
              fields={{ sub }}
              action={disableUserAction}
            />
          )}
        </div>
      </div>
      {resent === 'sent' && (
        <Alert variant="success">
          <AlertTitle>招待メールを再送しました。</AlertTitle>
        </Alert>
      )}
      {resent === 'failed' && (
        <Alert variant="destructive">
          <AlertTitle>招待メールを再送できませんでした</AlertTitle>
          <AlertDescription>時間をおいて、もう一度お試しください。</AlertDescription>
        </Alert>
      )}
    </>
  );
}

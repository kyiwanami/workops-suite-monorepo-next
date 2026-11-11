'use client';

import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { ConfirmButton } from '@workops/ui/workops/confirm-button';
import { Button } from '@workops/ui/components/button';
import { Spinner } from '@workops/ui/components/spinner';
import { type ReactNode, useState, useTransition } from 'react';
import { deleteUserAction, disableUserAction, enableUserAction, resendInvitationAction } from '../actions';
import type { UserDetail } from '../data';

// ユーザーの詳細の題と、状態に合わせたアカウントの操作です。
// 招待メールの再送は招待中だけ、削除は無効にした後だけ出します。
export function AccountActions({
  sub,
  email,
  displayName,
  status,
  badge,
}: {
  sub: string;
  email: string;
  displayName: string;
  status: UserDetail['status'];
  badge: ReactNode;
}) {
  const [resent, setResent] = useState(false);
  const [resending, startResend] = useTransition();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{displayName}</h1>
          {badge}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'invited' && (
            <Button
              variant="outline"
              disabled={resending}
              onClick={() =>
                startResend(async () => {
                  await resendInvitationAction(email);
                  setResent(true);
                })
              }
            >
              {resending && <Spinner />}
              {resending ? '再送しています' : '招待メールを再送する'}
            </Button>
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
      {resent && (
        <Alert variant="success">
          <AlertTitle>招待メールを再送しました。</AlertTitle>
        </Alert>
      )}
    </>
  );
}

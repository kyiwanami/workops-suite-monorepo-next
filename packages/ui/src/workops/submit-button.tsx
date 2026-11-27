import { Button, type buttonVariants } from '@workops/ui/components/button';
import { Spinner } from '@workops/ui/components/spinner';
import type { VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

// フォームの送信ボタンです。送信中は押せなくし、Spinner を添えて文言を進行中の形にします。
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  variant,
}: {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
} & VariantProps<typeof buttonVariants>) {
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </Button>
  );
}

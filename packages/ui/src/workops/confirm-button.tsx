'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@workops/ui/components/alert-dialog';
import { Button } from '@workops/ui/components/button';
import { cn } from '@workops/ui/lib/utils';
import { useFormStatus } from 'react-dom';
import { SubmitButton } from './submit-button';

// 確認の中の確定ボタンです。送信中は進行中の形にします。
function ConfirmSubmit({ label, pendingLabel, destructive }: { label: string; pendingLabel: string; destructive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <SubmitButton pending={pending} pendingLabel={pendingLabel} variant={destructive ? 'destructive' : 'default'}>
      {label}
    </SubmitButton>
  );
}

// 確認を挟んで操作を確定するボタンです。確認には操作の結果を書き、fields の値をフォームの値として action に渡します。
// 削除のように取り消せない操作は destructive にします。画面の主となる操作は primary にし、ボタンを塗りつぶします。
// 狭い画面では、確認を画面の下から出します。
export function ConfirmButton({
  label,
  title,
  description,
  pendingLabel,
  destructive,
  fields,
  action,
  primary,
  className,
}: {
  label: string;
  title: string;
  description: string;
  pendingLabel: string;
  destructive: boolean;
  fields: Record<string, string>;
  action: (formData: FormData) => Promise<void>;
  primary?: boolean;
  className?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={primary ? 'default' : 'outline'} className={cn(destructive && 'text-destructive', className)}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-md:top-auto max-md:bottom-0 max-md:translate-y-0 max-md:rounded-b-none max-md:max-w-none!">
        {/* 確認は編集のフォームの中から開くため、送信を外側のフォームへ伝えないようにします。 */}
        <form action={action} onSubmit={(event) => event.stopPropagation()} className="grid gap-4">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>
            <ConfirmSubmit label={label} pendingLabel={pendingLabel} destructive={destructive} />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

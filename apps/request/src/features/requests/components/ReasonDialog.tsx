'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@workops/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workops/ui/components/dialog';
import { Field, FieldError, FieldLabel } from '@workops/ui/components/field';
import { Textarea } from '@workops/ui/components/textarea';
import { FormFailure } from '@workops/ui/workops/form-failure';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import { unstable_rethrow } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { rejectRequestAction, returnRequestAction } from '@/server/requests/actions';
import { reasonSchema } from '@workops/schema/requests';

// 却下・差戻しの文言です。確認の本文には操作の結果を書きます。
const texts = {
  reject: {
    label: '却下',
    title: 'この申請を却下しますか？',
    description: () => '却下した申請は元に戻せず、申請者は再提出できません。',
    reason: '却下の理由',
    submit: '却下する',
    pending: '却下しています',
  },
  return: {
    label: '差戻し',
    title: 'この申請を差し戻しますか？',
    description: (requesterName: string | null) =>
      `申請は下書きに戻り、${requesterName === null ? '申請者' : `${requesterName}さん`}が修正して再提出できます。`,
    reason: '差戻しの理由',
    submit: '差し戻す',
    pending: '差し戻しています',
  },
};

// 却下・差戻しの確認です。理由の入力を必須にし、確定したら一覧へ戻ります。狭い画面では、確認を画面の下から出します。
// 操作に失敗したら、保存済みの申請を確認するよう案内します。
export function ReasonDialog({
  requestId,
  requesterName,
  kind,
}: {
  requestId: string;
  requesterName: string | null;
  kind: keyof typeof texts;
}) {
  const form = useForm({ resolver: zodResolver(reasonSchema), defaultValues: { reason: '' } });
  const text = texts[kind];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={kind === 'reject' ? 'text-destructive' : undefined}>
          {text.label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-md:top-auto max-md:bottom-0 max-md:max-w-none! max-md:translate-y-0 max-md:rounded-b-none md:max-w-[440px]">
        <form
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await (kind === 'reject' ? rejectRequestAction(requestId, values) : returnRequestAction(requestId, values));
            } catch (error) {
              // 操作のあとの画面の移動は、Next に任せる
              unstable_rethrow(error);
              console.error(error);
              form.setError('root', { message: '操作できませんでした。時間をおいて、もう一度お試しください。' });
            }
          })}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>{text.title}</DialogTitle>
            <DialogDescription>{text.description(requesterName)}</DialogDescription>
          </DialogHeader>
          <Controller
            name="reason"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${kind}-reason`}>{text.reason}</FieldLabel>
                <Textarea {...field} id={`${kind}-reason`} className="min-h-24" />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <FormFailure error={form.formState.errors.root} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">やめる</Button>
            </DialogClose>
            <SubmitButton
              pending={form.formState.isSubmitting}
              pendingLabel={text.pending}
              variant={kind === 'reject' ? 'destructive' : 'default'}
            >
              {text.submit}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

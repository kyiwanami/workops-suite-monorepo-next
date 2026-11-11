'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@workops/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workops/ui/components/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@workops/ui/components/field';
import { Input } from '@workops/ui/components/input';
import { Textarea } from '@workops/ui/components/textarea';
import { ConfirmButton } from '@workops/ui/workops/confirm-button';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { createRequestTypeAction, deleteRequestTypeAction, updateRequestTypeAction } from '../actions';
import type { RequestTypeRow } from '../data';
import { requestTypeSchema } from '../schema';

// 申請種別の登録・編集のフォームです。ダイアログを開くたびに作り直し、種別の今の値から始めます。コードも編集できます。
// 申請が使っている種別は削除できないため、件数を書き、削除を出しません。
function RequestTypeForm({ requestType, onSaved }: { requestType: RequestTypeRow | null; onSaved: () => void }) {
  const form = useForm({
    resolver: zodResolver(requestTypeSchema),
    defaultValues: {
      code: requestType?.code ?? '',
      name: requestType?.name ?? '',
      description: requestType?.description ?? '',
      // 表示順の空欄は NaN で表します。
      sortOrder: requestType?.sortOrder ?? Number.NaN,
    },
  });
  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        if (requestType === null) {
          await createRequestTypeAction(values);
        } else {
          await updateRequestTypeAction(requestType.id, values);
        }
        onSaved();
      })}
      className="grid gap-6"
    >
      <FieldGroup>
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>コード</FieldLabel>
              <Input {...field} id={field.name} className="font-mono" />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>種別名</FieldLabel>
              <Input {...field} id={field.name} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>説明</FieldLabel>
              <Textarea {...field} id={field.name} value={field.value ?? ''} />
            </Field>
          )}
        />
        <Controller
          name="sortOrder"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>表示順</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="number"
                className="font-mono"
                value={Number.isNaN(field.value) ? '' : field.value}
                onChange={(event) => field.onChange(event.target.valueAsNumber)}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      {requestType !== null && requestType.requestCount > 0 && (
        <p className="text-sm text-muted-foreground">この種別を使っている申請が {requestType.requestCount} 件あるため、削除できません。</p>
      )}
      <DialogFooter className="sm:justify-between">
        {requestType !== null && requestType.requestCount === 0 && (
          <ConfirmButton
            label="削除する"
            title={`種別「${requestType.name}」を削除しますか？`}
            description="削除した種別は元に戻せません。"
            pendingLabel="削除しています"
            destructive
            fields={{ id: requestType.id }}
            action={deleteRequestTypeAction}
          />
        )}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <DialogClose asChild>
            <Button variant="outline">やめる</Button>
          </DialogClose>
          <SubmitButton pending={form.formState.isSubmitting} pendingLabel={requestType === null ? '登録しています' : '保存しています'}>
            {requestType === null ? '登録する' : '保存する'}
          </SubmitButton>
        </div>
      </DialogFooter>
    </form>
  );
}

// 申請種別の登録・編集のダイアログです。種別を渡すと編集、渡さないと登録になります。保存したら閉じます。
export function RequestTypeDialog({ requestType, children }: { requestType: RequestTypeRow | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{requestType === null ? '種別を登録する' : '種別を編集する'}</DialogTitle>
        </DialogHeader>
        <RequestTypeForm requestType={requestType} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

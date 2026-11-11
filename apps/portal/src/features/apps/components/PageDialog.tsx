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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@workops/ui/components/field';
import { Input } from '@workops/ui/components/input';
import { RadioGroup, RadioGroupItem } from '@workops/ui/components/radio-group';
import { Textarea } from '@workops/ui/components/textarea';
import { ConfirmButton } from '@workops/ui/workops/confirm-button';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { createPageAction, deletePageAction, updatePageAction } from '../actions';
import type { AppRow } from '../data';
import { pageRoleLabels } from '../labels';
import { pageSchema } from '../schema';

// ページの登録・編集のフォームです。ダイアログを開くたびに作り直し、ページの今の値から始めます。編集ではページ ID を変えられません。
// 登録でページ ID がすでに使われていたら、ページ ID の項目にその旨を出します。
function PageForm({
  appId,
  page,
  onSaved,
}: {
  appId: string;
  page: AppRow['pages'][number] | null;
  onSaved: () => void;
}) {
  const form = useForm({
    resolver: zodResolver(pageSchema),
    defaultValues: {
      appId,
      pageId: page?.pageId ?? '',
      name: page?.name ?? '',
      description: page?.description ?? '',
      relativePath: page?.relativePath ?? '',
      role: page?.role ?? null,
    },
  });
  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        if (page !== null) {
          await updatePageAction(values);
          onSaved();
        } else if (await createPageAction(values)) {
          onSaved();
        } else {
          form.setError('pageId', { message: 'このページ ID はすでに使われています。' });
        }
      })}
      className="grid gap-6"
    >
      <FieldGroup>
        {page === null ? (
          <Controller
            name="pageId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>ページ ID</FieldLabel>
                <Input {...field} id={field.name} className="font-mono" />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ) : (
          <Field>
            <FieldLabel>ページ ID</FieldLabel>
            <p className="font-mono text-sm">{page.pageId}</p>
          </Field>
        )}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pageName">名称</FieldLabel>
              <Input {...field} id="pageName" />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="pageDescription">説明</FieldLabel>
              <Textarea {...field} id="pageDescription" value={field.value ?? ''} />
            </Field>
          )}
        />
        <Controller
          name="relativePath"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>相対パス</FieldLabel>
              <Input {...field} id={field.name} className="font-mono" placeholder="/assets" value={field.value ?? ''} />
              <FieldDescription>/ で始めて入力します。</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="role"
          control={form.control}
          render={({ field }) => (
            <FieldSet>
              <FieldLegend variant="label">必要なロール</FieldLegend>
              {/* 必要なロールが未設定のページは全員が見られるため、未設定を「全員」の選択肢で表します。 */}
              <RadioGroup
                name={field.name}
                value={field.value ?? 'all'}
                onValueChange={(value) => field.onChange(value === 'all' ? null : value)}
              >
                {Object.entries(pageRoleLabels).map(([value, label]) => (
                  <Field key={value} orientation="horizontal">
                    <RadioGroupItem id={`page-role-${value}`} value={value} />
                    <FieldLabel htmlFor={`page-role-${value}`} className="font-normal">
                      {label}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </FieldSet>
          )}
        />
      </FieldGroup>
      <DialogFooter className="sm:justify-between">
        {page !== null && (
          <ConfirmButton
            label="削除する"
            title={`ページ「${page.name}」を削除しますか？`}
            description="削除したページは元に戻せません。"
            pendingLabel="削除しています"
            destructive
            fields={{ appId, pageId: page.pageId }}
            action={deletePageAction}
          />
        )}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <DialogClose asChild>
            <Button variant="outline">やめる</Button>
          </DialogClose>
          <SubmitButton pending={form.formState.isSubmitting} pendingLabel={page === null ? '追加しています' : '保存しています'}>
            {page === null ? '追加する' : '保存する'}
          </SubmitButton>
        </div>
      </DialogFooter>
    </form>
  );
}

// ページの登録・編集のダイアログです。ページを渡すと編集、渡さないと登録になります。保存したら閉じます。
export function PageDialog({
  appId,
  page,
  children,
}: {
  appId: string;
  page: AppRow['pages'][number] | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{page === null ? 'ページを追加する' : 'ページを編集する'}</DialogTitle>
        </DialogHeader>
        <PageForm appId={appId} page={page} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

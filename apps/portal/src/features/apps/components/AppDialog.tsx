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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@workops/ui/components/field';
import { Input } from '@workops/ui/components/input';
import { Textarea } from '@workops/ui/components/textarea';
import { ConfirmButton } from '@workops/ui/workops/confirm-button';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { createAppAction, deleteAppAction, updateAppAction } from '../actions';
import type { listApps } from '../data';
import { appSchema } from '../schema';

// アプリの登録・編集のフォームです。ダイアログを開くたびに作り直し、アプリの今の値から始めます。編集ではアプリ ID を変えられません。
// 登録でアプリ ID がすでに使われていたら、アプリ ID の項目にその旨を出します。
function AppForm({ app, onSaved }: { app: Awaited<ReturnType<typeof listApps>>[number] | null; onSaved: () => void }) {
  const form = useForm({
    resolver: zodResolver(appSchema),
    defaultValues: {
      appId: app?.appId ?? '',
      name: app?.name ?? '',
      description: app?.description ?? '',
      urlDomain: app?.urlDomain ?? '',
      iconName: app?.iconName ?? '',
    },
  });
  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        if (app !== null) {
          await updateAppAction(values);
          onSaved();
        } else if (await createAppAction(values)) {
          onSaved();
        } else {
          form.setError('appId', { message: 'このアプリ ID はすでに使われています。' });
        }
      })}
      className="grid gap-6"
    >
      <FieldGroup>
        {app === null ? (
          <Controller
            name="appId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>アプリ ID</FieldLabel>
                <Input {...field} id={field.name} className="font-mono" />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ) : (
          <Field>
            <FieldLabel>アプリ ID</FieldLabel>
            <p className="font-mono text-sm">{app.appId}</p>
          </Field>
        )}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>名称</FieldLabel>
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
              <Textarea {...field} id={field.name} />
            </Field>
          )}
        />
        <Controller
          name="urlDomain"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>URL</FieldLabel>
              <Input {...field} id={field.name} className="font-mono" />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="iconName"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>アイコン</FieldLabel>
              <Input {...field} id={field.name} className="font-mono" />
              <FieldDescription>lucide のアイコン名で入力します（例：package）。</FieldDescription>
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter className="sm:justify-between">
        {app !== null && (
          <ConfirmButton
            label="削除する"
            title={`アプリ「${app.name}」を削除しますか？`}
            description={
              app.pages.length === 0
                ? '削除したアプリは元に戻せません。'
                : `配下のページ ${app.pages.length} 件（${app.pages.map((item) => item.name).join('、')}）も一緒に削除されます。削除したアプリとページは元に戻せません。`
            }
            pendingLabel="削除しています"
            destructive
            fields={{ appId: app.appId }}
            action={deleteAppAction}
          />
        )}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <DialogClose asChild>
            <Button variant="outline">やめる</Button>
          </DialogClose>
          <SubmitButton pending={form.formState.isSubmitting} pendingLabel={app === null ? '登録しています' : '保存しています'}>
            {app === null ? '登録する' : '保存する'}
          </SubmitButton>
        </div>
      </DialogFooter>
    </form>
  );
}

// アプリの登録・編集のダイアログです。アプリを渡すと編集、渡さないと登録になります。保存したら閉じます。
export function AppDialog({ app, children }: { app: Awaited<ReturnType<typeof listApps>>[number] | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{app === null ? 'アプリを登録する' : 'アプリを編集する'}</DialogTitle>
        </DialogHeader>
        <AppForm app={app} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

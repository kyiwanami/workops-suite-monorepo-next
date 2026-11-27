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
import { FormFailure } from '@workops/ui/workops/form-failure';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import { type ReactNode, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { createAppAction, deleteAppAction, updateAppAction } from '@/server/apps/actions';
import type { AppRow } from '@/server/apps/data';
import { appSchema } from '../schema';
import { serializeAppSearchParams } from '../search-params';

// アプリの登録・編集のフォームです。ダイアログを開くたびに作り直し、アプリの今の値から始めます。編集ではアプリ ID を変えられません。
// 登録でアプリ ID がすでに使われていたら、アプリ ID の項目にその旨を出します。
function AppForm({ app, onSaved }: { app: AppRow | null; onSaved: (done: 'appCreated' | 'appSaved') => void }) {
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
        try {
          if (app !== null) {
            await updateAppAction(values);
            onSaved('appSaved');
          } else if (await createAppAction(values)) {
            onSaved('appCreated');
          } else {
            form.setError('appId', { message: 'このアプリ ID はすでに使われています。' });
          }
        } catch (error) {
          // 画面の移動などは Next に任せ、予期しない失敗はボタンの近くに出す
          unstable_rethrow(error);
          console.error(error);
          form.setError('root', { message: '保存できませんでした。時間をおいて、もう一度お試しください。' });
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
              <Textarea {...field} id={field.name} value={field.value ?? ''} />
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
              <Input {...field} id={field.name} className="font-mono" value={field.value ?? ''} />
              <FieldDescription>lucide のアイコン名で入力します（例：package）。</FieldDescription>
            </Field>
          )}
        />
      </FieldGroup>
      <FormFailure error={form.formState.errors.root} />
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
export function AppDialog({ app, children }: { app: AppRow | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{app === null ? 'アプリを登録する' : 'アプリを編集する'}</DialogTitle>
        </DialogHeader>
        <AppForm app={app} onSaved={(done) => {
            // 登録・保存した旨を一覧の題の下に出す
            router.replace(serializeAppSearchParams('/admin/apps', { done }), { scroll: false });
            setOpen(false);
          }} />
      </DialogContent>
    </Dialog>
  );
}

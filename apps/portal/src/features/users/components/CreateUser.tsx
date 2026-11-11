'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertDescription, AlertTitle } from '@workops/ui/components/alert';
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
import { PageHeader } from '@workops/ui/workops/page-header';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { createUserAction } from '../actions';
import { userSchema } from '../schema';
import { DepartmentField } from './DepartmentField';
import { RoleField } from './RoleField';

// ユーザーの作成フォームです。ダイアログを開くたびに作り直し、空の値から始めます。
// メールのユーザーがすでにいるときは、メールの項目にその旨を出します。
function CreateUserForm({
  departments,
  onCreated,
}: {
  departments: { id: string; name: string }[];
  onCreated: (output: Awaited<ReturnType<typeof createUserAction>>) => void;
}) {
  const form = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', departmentId: '', role: '' },
  });
  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        const output = await createUserAction(values);
        if (output.result === 'exists') {
          form.setError('email', { message: 'このメールのユーザーはすでにいます。' });
        } else {
          onCreated(output);
        }
      })}
      className="grid gap-6"
    >
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>名前</FieldLabel>
              <Input {...field} id={field.name} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>メール</FieldLabel>
              <Input {...field} id={field.name} type="email" />
              <FieldDescription>このアドレスに、仮パスワード入りの招待メールが届きます。</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="departmentId"
          control={form.control}
          render={({ field, fieldState }) => <DepartmentField departments={departments} value={field.value} onChange={field.onChange} fieldState={fieldState} />}
        />
        <Controller
          name="role"
          control={form.control}
          render={({ field, fieldState }) => <RoleField value={field.value} onChange={field.onChange} fieldState={fieldState} />}
        />
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">やめる</Button>
        </DialogClose>
        <SubmitButton pending={form.formState.isSubmitting} pendingLabel="作成しています">
          作成して招待する
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

// ユーザーの一覧の題と「ユーザーを作成する」、作成の結果の通知です。
// 名前・メール・部署・ロールを1つのダイアログで入力し、作成と所属の設定を1回で行います。
export function CreateUser({ departments }: { departments: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<Awaited<ReturnType<typeof createUserAction>> | null>(null);
  return (
    <>
      <PageHeader title="ユーザー">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>ユーザーを作成する</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>ユーザーを作成する</DialogTitle>
            </DialogHeader>
            <CreateUserForm
              departments={departments}
              onCreated={(output) => {
                setCreated(output);
                setOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </PageHeader>
      {created?.result === 'created' && (
        <Alert variant="success">
          <AlertTitle>{created.name}さんを招待しました</AlertTitle>
          <AlertDescription>{created.email} に仮パスワード入りの招待メールを送りました。</AlertDescription>
        </Alert>
      )}
      {created?.result === 'membershipFailed' && (
        <Alert variant="warning">
          <AlertTitle>{created.name}さんを招待しました。所属を設定できませんでした。</AlertTitle>
          <AlertDescription>
            <Link href={`/admin/users/${created.sub}`} className="font-bold text-primary">
              所属を設定する
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

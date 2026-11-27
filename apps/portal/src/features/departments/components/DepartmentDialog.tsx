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
import { FormFailure } from '@workops/ui/workops/form-failure';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import { type ReactNode, useState } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { createDepartmentAction, deleteDepartmentAction, updateDepartmentAction } from '@/server/departments/actions';
import type { DepartmentRow } from '@/server/departments/data';
import { departmentSchema } from '../schema';
import { serializeDepartmentSearchParams } from '../search-params';

// 部署の登録・編集のフォームです。ダイアログを開くたびに作り直し、部署の今の値から始めます。
// 編集では左下に削除を置きます。所属・資産・申請のある部署は削除できないため、削除の代わりに件数と理由を書きます。
function DepartmentForm({
  department,
  onSaved,
}: {
  department: DepartmentRow | null;
  onSaved: (done: 'created' | 'saved') => void;
}) {
  const form = useForm({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      code: department?.code ?? '',
      name: department?.name ?? '',
      // 表示順の空欄は NaN で表します。
      sortOrder: department?.sortOrder ?? Number.NaN,
      notes: department?.notes ?? '',
    },
  });
  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await (department === null ? createDepartmentAction(values) : updateDepartmentAction(department.id, values));
          onSaved(department === null ? 'created' : 'saved');
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
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>部署コード</FieldLabel>
              <Input {...field} id={field.name} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>部署名</FieldLabel>
              <Input {...field} id={field.name} />
              <FieldError errors={[fieldState.error]} />
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
        <Controller
          name="notes"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>備考</FieldLabel>
              <Textarea {...field} id={field.name} value={field.value ?? ''} />
            </Field>
          )}
        />
      </FieldGroup>
      {department !== null && department.memberCount > 0 && (
        <p className="text-sm text-muted-foreground">
          この部署には {department.memberCount} 人が所属しています。削除するには、所属先をユーザー管理で変更してください。
        </p>
      )}
      {department !== null && department.assetCount + department.requestCount > 0 && (
        <p className="text-sm text-muted-foreground">
          この部署の資産が {department.assetCount} 件、申請が {department.requestCount} 件あるため、削除できません。
        </p>
      )}
      <FormFailure error={form.formState.errors.root} />
      <DialogFooter className="sm:justify-between">
        {department !== null && department.memberCount + department.assetCount + department.requestCount === 0 && (
          <ConfirmButton
            label="削除する"
            title={`部署「${department.name}」を削除しますか？`}
            description="削除した部署は元に戻せません。"
            pendingLabel="削除しています"
            destructive
            fields={{ id: department.id }}
            action={deleteDepartmentAction}
          />
        )}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <DialogClose asChild>
            <Button variant="outline">やめる</Button>
          </DialogClose>
          <SubmitButton pending={form.formState.isSubmitting} pendingLabel={department === null ? '登録しています' : '保存しています'}>
            {department === null ? '登録する' : '保存する'}
          </SubmitButton>
        </div>
      </DialogFooter>
    </form>
  );
}

// 部署の登録・編集のダイアログです。部署を渡すと編集、渡さないと登録になります。保存したら閉じます。
export function DepartmentDialog({
  department,
  children,
}: {
  department: DepartmentRow | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{department === null ? '部署を登録する' : '部署を編集する'}</DialogTitle>
        </DialogHeader>
        <DepartmentForm department={department} onSaved={(done) => {
            // 登録・保存した旨を一覧の題の下に出す
            router.replace(serializeDepartmentSearchParams('/admin/departments', { done }), { scroll: false });
            setOpen(false);
          }} />
      </DialogContent>
    </Dialog>
  );
}

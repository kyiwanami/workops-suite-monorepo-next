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
import { createAssetTypeAction, deleteAssetTypeAction, updateAssetTypeAction } from '../actions';
import type { AssetTypeRow } from '../data';
import { assetTypeSchema } from '../schema';

// 資産種別の登録・編集のフォームです。ダイアログを開くたびに作り直し、種別の今の値から始めます。編集ではコードを変えられません。
// 登録でコードがすでに使われていたら、コードの項目にその旨を出します。資産がある種別は削除できないため、件数と変更の場所を書きます。
function AssetTypeForm({
  assetType,
  onSaved,
}: {
  assetType: AssetTypeRow | null;
  onSaved: () => void;
}) {
  const form = useForm({
    resolver: zodResolver(assetTypeSchema),
    defaultValues: {
      code: assetType?.code ?? '',
      name: assetType?.name ?? '',
      description: assetType?.description ?? '',
      // 表示順の空欄は NaN で表します。
      sortOrder: assetType?.sortOrder ?? Number.NaN,
    },
  });
  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        if (assetType !== null) {
          await updateAssetTypeAction(assetType.id, values);
          onSaved();
        } else if (await createAssetTypeAction(values)) {
          onSaved();
        } else {
          form.setError('code', { message: 'このコードはすでに使われています。別のコードを入力してください。' });
        }
      })}
      className="grid gap-6"
    >
      <FieldGroup>
        {assetType === null ? (
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
        ) : (
          <Field>
            <FieldLabel>コード</FieldLabel>
            <p className="font-mono text-sm">{assetType.code}</p>
          </Field>
        )}
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
      {assetType !== null && assetType.assetCount > 0 && (
        <p className="text-sm text-muted-foreground">
          この種別の資産が {assetType.assetCount} 件あります。削除するには、資産の種別を変更してください。
        </p>
      )}
      <DialogFooter className="sm:justify-between">
        {assetType !== null && assetType.assetCount === 0 && (
          <ConfirmButton
            label="削除する"
            title={`種別「${assetType.name}」を削除しますか？`}
            description="削除した種別は元に戻せません。"
            pendingLabel="削除しています"
            destructive
            fields={{ id: assetType.id }}
            action={deleteAssetTypeAction}
          />
        )}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <DialogClose asChild>
            <Button variant="outline">やめる</Button>
          </DialogClose>
          <SubmitButton pending={form.formState.isSubmitting} pendingLabel={assetType === null ? '登録しています' : '保存しています'}>
            {assetType === null ? '登録する' : '保存する'}
          </SubmitButton>
        </div>
      </DialogFooter>
    </form>
  );
}

// 資産種別の登録・編集のダイアログです。種別を渡すと編集、渡さないと登録になります。保存したら閉じます。
export function AssetTypeDialog({
  assetType,
  children,
}: {
  assetType: AssetTypeRow | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{assetType === null ? '種別を登録する' : '種別を編集する'}</DialogTitle>
        </DialogHeader>
        <AssetTypeForm assetType={assetType} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

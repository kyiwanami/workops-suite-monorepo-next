'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@workops/ui/components/button';
import { Card, CardContent } from '@workops/ui/components/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@workops/ui/components/field';
import { Input } from '@workops/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workops/ui/components/select';
import { Textarea } from '@workops/ui/components/textarea';
import { FormFailure } from '@workops/ui/workops/form-failure';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import Link from 'next/link';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { createRequestAction, submitRequestAction, updateRequestAction } from '@/server/requests/actions';
import type { Option, RequestDetail } from '@/server/requests/data';
import { requestSchema } from '@workops/schema/requests';
import { serializeRequestSearchParams } from '../search-params';
import { ActionBar } from './ActionBar';
import { OperationError } from './OperationError';

// 申請の作成・本人の下書きの編集のフォームです。申請を渡すと編集、渡さないと作成になります。
// 「下書き保存」は保存して一覧へ戻ります。「提出」は保存してから提出する2段の処理で、提出に失敗しても下書きは残し、保存済みの申請へ案内します。
// 差し戻された下書きでは、提出のボタンを「再提出」にします。
export function RequestForm({
  request,
  requestTypes,
  resubmit,
}: {
  request: RequestDetail | null;
  requestTypes: Option[];
  resubmit: boolean;
}) {
  const router = useRouter();
  // 提出できなかった、保存済みの下書きの ID です。
  const [unsubmitted, setUnsubmitted] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      requestTypeId: request?.requestTypeId ?? '',
      title: request?.title ?? '',
      amount: request?.amount ?? null,
      description: request?.description ?? '',
    },
  });
  // 申請を保存し、提出するときは続けて提出します。
  const save = (submit: boolean) =>
    form.handleSubmit(async (values: z.infer<typeof requestSchema>) => {
      setUnsubmitted(null);
      const saved = await (request === null ? createRequestAction(values) : updateRequestAction(request.id, values)).catch((error: Error) => {
        unstable_rethrow(error);
        console.error(error);
        return null;
      });
      // 予期しない失敗で保存できなかった
      if (saved === null) {
        form.setError('root', { message: '保存できませんでした。時間をおいて、もう一度お試しください。' });
        return;
      }
      // 業務のルールで保存できなかった
      if ('message' in saved) {
        form.setError('root', { message: saved.message });
        return;
      }
      if (!submit) {
        router.push(serializeRequestSearchParams('/requests', { done: 'saved' }));
        return;
      }
      try {
        await submitRequestAction(saved.id);
      } catch (error) {
        // 提出できたときの一覧への移動は、Next に任せる
        unstable_rethrow(error);
        console.error(error);
        setUnsubmitted(saved.id);
      }
    });
  const pending = form.formState.isSubmitting;
  return (
    <form onSubmit={save(true)} className="grid gap-4">
      <Card>
        <CardContent>
          <FieldGroup>
            <Controller
              name="requestTypeId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="requestTypeId">申請種別</FieldLabel>
                  <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="requestTypeId" className="w-full">
                      <SelectValue placeholder="種別を選ぶ" />
                    </SelectTrigger>
                    <SelectContent>
                      {requestTypes.map((requestType) => (
                        <SelectItem key={requestType.id} value={requestType.id}>
                          {requestType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>件名</FieldLabel>
                  <Input {...field} id={field.name} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>金額</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="number"
                    className="font-mono tabular-nums"
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value === '' ? null : event.target.valueAsNumber)}
                  />
                  <FieldDescription>円単位の整数で入力します。任意です。</FieldDescription>
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
          </FieldGroup>
        </CardContent>
      </Card>
      <FormFailure error={form.formState.errors.root} />
      {unsubmitted !== null && (
        <OperationError title="提出できませんでした" description="入力内容は下書きとして保存されています。時間をおいて、もう一度提出してください。" requestId={unsubmitted} />
      )}
      <ActionBar>
        {request === null && (
          <Button variant="outline" asChild className="max-md:hidden">
            <Link href="/requests">やめる</Link>
          </Button>
        )}
        <Button type="button" variant="outline" disabled={pending} onClick={save(false)}>
          下書き保存
        </Button>
        <SubmitButton pending={pending} pendingLabel="保存しています">
          {resubmit ? '再提出' : '提出'}
        </SubmitButton>
      </ActionBar>
    </form>
  );
}

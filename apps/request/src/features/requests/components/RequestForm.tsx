'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@workops/ui/components/button';
import { Card, CardContent } from '@workops/ui/components/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@workops/ui/components/field';
import { Input } from '@workops/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workops/ui/components/select';
import { Textarea } from '@workops/ui/components/textarea';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { createRequestAction, submitRequestAction, updateRequestAction } from '../actions';
import type { Option, RequestDetail } from '../data';
import { requestSchema } from '../schema';
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
  const [failure, setFailure] = useState<{ submitted: boolean; requestId: string | null } | null>(null);
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
      setFailure(null);
      let requestId: string;
      try {
        requestId = await (request === null ? createRequestAction(values) : updateRequestAction(request.id, values));
      } catch (error) {
        console.error(error);
        setFailure({ submitted: false, requestId: request === null ? null : request.id });
        return;
      }
      if (!submit) {
        router.push(serializeRequestSearchParams('/requests', { saved: true }));
        return;
      }
      try {
        await submitRequestAction(requestId);
      } catch (error) {
        console.error(error);
        setFailure({ submitted: true, requestId });
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
      {failure !== null &&
        (failure.submitted ? (
          <OperationError title="提出できませんでした" description="入力内容は下書きとして保存されています。" requestId={failure.requestId} />
        ) : (
          <OperationError
            title="保存できませんでした"
            description="保存済みの申請を確認してください。"
            requestId={failure.requestId}
          />
        ))}
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

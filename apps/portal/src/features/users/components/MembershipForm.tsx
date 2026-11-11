'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertTitle } from '@workops/ui/components/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@workops/ui/components/card';
import { Checkbox } from '@workops/ui/components/checkbox';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@workops/ui/components/field';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { saveMembershipAction } from '../actions';
import { membershipSchema } from '../schema';
import { DepartmentField } from './DepartmentField';
import { RoleField } from './RoleField';

// 所属（部署・ロール・全体管理者）をまとめて保存するフォームです。
// 保存できなかったときは、画面を読み直して今の所属を確かめ、再設定してもらいます。
export function MembershipForm({
  sub,
  departments,
  membership,
}: {
  sub: string;
  departments: { id: string; name: string }[];
  membership: { departmentId: string; role: string; isAdmin: boolean } | null;
}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const form = useForm({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      sub,
      departmentId: membership?.departmentId ?? '',
      role: membership?.role ?? '',
      isAdmin: membership?.isAdmin ?? false,
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>所属</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(async (values) => setSaved(await saveMembershipAction(values)))}
          className="grid max-w-[560px] gap-6"
        >
          {saved === true && (
            <Alert variant="success">
              <AlertTitle>所属を保存しました。</AlertTitle>
            </Alert>
          )}
          {saved === false && (
            <Alert variant="destructive">
              <AlertTitle>所属を保存できませんでした。画面を読み直して現在の所属を確認し、もう一度保存してください。</AlertTitle>
            </Alert>
          )}
          <FieldGroup>
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
            <Controller
              name="isAdmin"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox id={field.name} checked={field.value} onCheckedChange={field.onChange} />
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>全体管理者にする</FieldLabel>
                    <FieldDescription>部署をまたいで操作でき、ユーザー・部署・アプリを管理できます</FieldDescription>
                  </FieldContent>
                </Field>
              )}
            />
          </FieldGroup>
          <div>
            <SubmitButton pending={form.formState.isSubmitting} pendingLabel="保存しています">
              所属を保存する
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

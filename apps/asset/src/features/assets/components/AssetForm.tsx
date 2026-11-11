'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@workops/ui/components/button';
import { Card, CardContent, CardFooter } from '@workops/ui/components/card';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@workops/ui/components/field';
import { Input } from '@workops/ui/components/input';
import { RadioGroup, RadioGroupItem } from '@workops/ui/components/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workops/ui/components/select';
import { SubmitButton } from '@workops/ui/workops/submit-button';
import Link from 'next/link';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { createAssetAction, updateAssetAction } from '../actions';
import type { AssetDetail, Member, Option } from '../data';
import { formatDateTime, statusBadges } from '../labels';
import { assetSchema, assetStatus } from '../schema';
import { AssigneeField } from './AssigneeField';

// 資産の登録・編集のフォームです。資産を渡すと編集、渡さないと登録になります。
// 部署の選択肢を渡したとき（全体管理者の登録）だけ部署を選べ、部署を変えたら担当者を未割当に戻して、その部署の利用者を選択肢にします。
// 保存したら一覧へ戻ります。
export function AssetForm({
  asset,
  departmentId,
  departments,
  assetTypes,
  members,
}: {
  asset: AssetDetail | null;
  departmentId: string;
  departments: Option[] | null;
  assetTypes: Option[];
  members: Member[];
}) {
  const form = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      departmentId,
      name: asset?.name ?? '',
      assetTypeId: asset?.assetTypeId ?? '',
      status: asset?.status ?? 'inStock',
      assigneeSub: asset?.assigneeSub ?? null,
    },
  });
  const selectedDepartmentId = useWatch({ control: form.control, name: 'departmentId' });
  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        await (asset === null ? createAssetAction(values) : updateAssetAction(asset.id, values));
      })}
    >
      <Card>
        <CardContent>
          <FieldGroup>
            {departments !== null && (
              <Controller
                name="departmentId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="departmentId">部署</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('assigneeSub', null);
                      }}
                    >
                      <SelectTrigger id="departmentId" className="w-full">
                        <SelectValue placeholder="部署を選ぶ" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
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
              name="assetTypeId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="assetTypeId">種別</FieldLabel>
                  <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="assetTypeId" className="w-full">
                      <SelectValue placeholder="種別を選ぶ" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((assetType) => (
                        <SelectItem key={assetType.id} value={assetType.id}>
                          {assetType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="status"
              control={form.control}
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">状態</FieldLegend>
                  <RadioGroup name={field.name} value={field.value} onValueChange={field.onChange} className="flex flex-wrap gap-x-6">
                    {assetStatus.options.map((value) => (
                      <Field key={value} orientation="horizontal" className="w-auto">
                        <RadioGroupItem id={`status-${value}`} value={value} />
                        <FieldLabel htmlFor={`status-${value}`}>{statusBadges[value].label}</FieldLabel>
                      </Field>
                    ))}
                  </RadioGroup>
                </FieldSet>
              )}
            />
            <Controller
              name="assigneeSub"
              control={form.control}
              render={({ field }) => (
                <AssigneeField
                  members={members.filter((member) => member.departmentId === selectedDepartmentId)}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {asset !== null && `更新：${formatDateTime(asset.updatedAt)}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/assets">やめる</Link>
            </Button>
            <SubmitButton pending={form.formState.isSubmitting} pendingLabel={asset === null ? '登録しています' : '保存しています'}>
              {asset === null ? '登録する' : '保存する'}
            </SubmitButton>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}

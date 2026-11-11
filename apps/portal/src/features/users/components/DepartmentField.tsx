'use client';

import { Field, FieldError, FieldLabel } from '@workops/ui/components/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workops/ui/components/select';
import type { ControllerFieldState } from 'react-hook-form';

// 所属部署の選択です。
export function DepartmentField({
  departments,
  value,
  onChange,
  fieldState,
}: {
  departments: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  fieldState: ControllerFieldState;
}) {
  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="departmentId">部署</FieldLabel>
      <Select name="departmentId" value={value} onValueChange={onChange}>
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
  );
}

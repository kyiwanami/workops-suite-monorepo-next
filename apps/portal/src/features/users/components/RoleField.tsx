'use client';

import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from '@workops/ui/components/field';
import { RadioGroup, RadioGroupItem } from '@workops/ui/components/radio-group';
import { roles } from '@workops/ui/lib/roles';
import type { ControllerFieldState } from 'react-hook-form';

// ロールの選択です。選択肢が3つなのでラジオボタンで全部見せ、それぞれでできることを1行で書きます。
export function RoleField({
  value,
  onChange,
  fieldState,
}: {
  value: string;
  onChange: (value: string) => void;
  fieldState: ControllerFieldState;
}) {
  return (
    <FieldSet data-invalid={fieldState.invalid}>
      <FieldLegend variant="label">ロール</FieldLegend>
      <RadioGroup name="role" value={value} onValueChange={onChange}>
        {roles.map((role) => (
          <Field key={role.value} orientation="horizontal">
            <RadioGroupItem id={`role-${role.value}`} value={role.value} />
            <FieldContent>
              <FieldLabel htmlFor={`role-${role.value}`}>{role.label}</FieldLabel>
              <FieldDescription>{role.description}</FieldDescription>
            </FieldContent>
          </Field>
        ))}
      </RadioGroup>
      <FieldError errors={[fieldState.error]} />
    </FieldSet>
  );
}

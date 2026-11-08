'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createDepartment } from './data';

// 部署の登録フォームの入力です。
const departmentInput = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.coerce.number().int(),
  notes: z.string(),
});

// 入力を検証して部署を登録し、一覧を最新にします。
export async function createDepartmentAction(formData: FormData) {
  const input = departmentInput.parse(Object.fromEntries(formData));
  await createDepartment({ ...input, notes: input.notes === '' ? null : input.notes });
  revalidatePath('/admin/departments');
}

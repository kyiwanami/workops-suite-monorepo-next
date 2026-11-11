'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { createDepartment, deleteDepartment, updateDepartment } from './data';
import { departmentSchema } from './schema';

// 入力を検証して部署を登録または更新し、一覧を最新にします。id が空なら登録、あれば更新です。
export async function saveDepartmentAction(input: z.infer<typeof departmentSchema>) {
  const values = departmentSchema.parse(input);
  if (values.id === '') {
    await createDepartment(values);
  } else {
    await updateDepartment(values);
  }
  revalidatePath('/admin/departments');
}

// 部署を削除し、一覧を最新にします。
export async function deleteDepartmentAction(formData: FormData) {
  await deleteDepartment(String(formData.get('id')));
  revalidatePath('/admin/departments');
}

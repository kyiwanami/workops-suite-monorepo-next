'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createDepartment, deleteDepartment, updateDepartment } from './data';
import { departmentSchema } from './schema';

// 入力を検証して部署を登録し、一覧を最新にします。
export async function createDepartmentAction(input: z.infer<typeof departmentSchema>) {
  await createDepartment(departmentSchema.parse(input));
  revalidatePath('/admin/departments');
}

// 入力を検証して部署を更新し、一覧を最新にします。
export async function updateDepartmentAction(id: string, input: z.infer<typeof departmentSchema>) {
  await updateDepartment(z.uuid().parse(id), departmentSchema.parse(input));
  revalidatePath('/admin/departments');
}

// 部署を削除し、一覧を最新にします。
export async function deleteDepartmentAction(formData: FormData) {
  await deleteDepartment(String(formData.get('id')));
  revalidatePath('/admin/departments');
}

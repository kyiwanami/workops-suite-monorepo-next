'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createDepartment, deleteDepartment, updateDepartment } from './data';
import { departmentSchema } from '@/features/departments/schema';
import { serializeDepartmentSearchParams } from '@/features/departments/search-params';

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

// 部署を削除し、削除した旨を出す一覧へ戻ります。所属・資産・申請が残っていて削除できなければ、その旨を返します。
export async function deleteDepartmentAction(formData: FormData) {
  if (!(await deleteDepartment(String(formData.get('id'))))) {
    return '削除できませんでした。この部署の所属・資産・申請が残っています。';
  }
  revalidatePath('/admin/departments');
  redirect(serializeDepartmentSearchParams('/admin/departments', { done: 'deleted' }));
}

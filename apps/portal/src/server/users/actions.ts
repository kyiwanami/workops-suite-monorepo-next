'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createUser, deleteUser, disableUser, enableUser, resendInvitation, saveMembership } from './data';
import { membershipSchema, userSchema } from '@/features/users/schema';
import { serializeUserDetailSearchParams, serializeUserSearchParams } from '@/features/users/search-params';

// ユーザーの作成の結果です。作成したときは、結果の通知のため名前とメールも返します。
export type CreateUserResult = { result: 'exists' } | { result: 'created' | 'membershipFailed'; sub: string; name: string; email: string };

// 入力を検証してユーザーを作成し、招待メールを送って所属を登録します。
// メールのユーザーがすでにいるときは exists、所属の登録だけ失敗したときは membershipFailed を返します。
export async function createUserAction(input: z.infer<typeof userSchema>): Promise<CreateUserResult> {
  const values = userSchema.parse(input);
  const sub = await createUser(values);
  if (sub === null) {
    return { result: 'exists' };
  }
  const saved = await saveMembership({ sub, departmentId: values.departmentId, role: values.role, isAdmin: false }).then(
    () => true,
    (error) => {
      console.error(error);
      return false;
    },
  );
  revalidatePath('/admin/users');
  return { result: saved ? 'created' : 'membershipFailed', sub, name: values.name, email: values.email };
}

// 入力を検証して所属を保存します。保存できたかどうかを返します。
export async function saveMembershipAction(input: z.infer<typeof membershipSchema>) {
  const values = membershipSchema.parse(input);
  const saved = await saveMembership(values).then(
    () => true,
    (error) => {
      console.error(error);
      return false;
    },
  );
  revalidatePath(`/admin/users/${values.sub}`);
  revalidatePath('/admin/users');
  return saved;
}

// 招待メールを再送します。
export async function resendInvitationAction(email: string) {
  await resendInvitation(email);
}

// ユーザーを有効にし、有効にした旨を出す詳細へ戻ります。
export async function enableUserAction(formData: FormData) {
  const sub = z.uuid().parse(formData.get('sub'));
  await enableUser(sub);
  revalidatePath(`/admin/users/${sub}`);
  redirect(serializeUserDetailSearchParams(`/admin/users/${sub}`, { done: 'enabled' }));
}

// ユーザーを無効にし、無効にした旨を出す詳細へ戻ります。
export async function disableUserAction(formData: FormData) {
  const sub = z.uuid().parse(formData.get('sub'));
  await disableUser(sub);
  revalidatePath(`/admin/users/${sub}`);
  redirect(serializeUserDetailSearchParams(`/admin/users/${sub}`, { done: 'disabled' }));
}

// ユーザーを削除し、削除した旨を出す一覧へ戻ります。
export async function deleteUserAction(formData: FormData) {
  await deleteUser(z.uuid().parse(formData.get('sub')));
  revalidatePath('/admin/users');
  redirect(serializeUserSearchParams('/admin/users', { done: 'deleted' }));
}

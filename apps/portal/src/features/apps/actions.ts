'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { createApp, createPage, deleteApp, deletePage, updateApp, updatePage } from './data';
import { appSchema, pageSchema } from './schema';

// 入力を検証してアプリを登録し、管理の一覧とホームを最新にします。アプリ ID がすでに使われていたら false を返します。
export async function createAppAction(input: z.infer<typeof appSchema>) {
  const created = await createApp(appSchema.parse(input));
  revalidatePath('/admin/apps');
  revalidatePath('/');
  return created;
}

// 入力を検証してアプリを更新し、管理の一覧とホームを最新にします。
export async function updateAppAction(input: z.infer<typeof appSchema>) {
  await updateApp(appSchema.parse(input));
  revalidatePath('/admin/apps');
  revalidatePath('/');
}

// アプリと配下のページを削除し、管理の一覧とホームを最新にします。
export async function deleteAppAction(formData: FormData) {
  await deleteApp(String(formData.get('appId')));
  revalidatePath('/admin/apps');
  revalidatePath('/');
}

// 入力を検証してページを登録し、管理の一覧とホームを最新にします。ページ ID がすでに使われていたら false を返します。
export async function createPageAction(input: z.infer<typeof pageSchema>) {
  const created = await createPage(pageSchema.parse(input));
  revalidatePath('/admin/apps');
  revalidatePath('/');
  return created;
}

// 入力を検証してページを更新し、管理の一覧とホームを最新にします。
export async function updatePageAction(input: z.infer<typeof pageSchema>) {
  await updatePage(pageSchema.parse(input));
  revalidatePath('/admin/apps');
  revalidatePath('/');
}

// ページを削除し、管理の一覧とホームを最新にします。
export async function deletePageAction(formData: FormData) {
  await deletePage(String(formData.get('appId')), String(formData.get('pageId')));
  revalidatePath('/admin/apps');
  revalidatePath('/');
}

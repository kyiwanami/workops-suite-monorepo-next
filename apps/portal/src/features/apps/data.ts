import 'server-only';
import { db } from '@workops/server/db';
import { app, page } from '@workops/blocks/schema';
import { and, asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { getAdmin } from '@/user';
import type { appSchema, pageSchema } from './schema';

// アプリを作成順に、配下のページをページ ID の順に付けて返します。
export async function listApps() {
  await getAdmin();
  const [apps, pages] = await Promise.all([
    db
      .select({ appId: app.appId, name: app.name, description: app.description, urlDomain: app.urlDomain, iconName: app.iconName })
      .from(app)
      .orderBy(asc(app.createdAt)),
    db
      .select({
        appId: page.appId,
        pageId: page.pageId,
        name: page.name,
        description: page.description,
        relativePath: page.relativePath,
        role: page.role,
      })
      .from(page)
      .orderBy(asc(page.pageId)),
  ]);
  return apps.map((item) => ({ ...item, pages: pages.filter((child) => child.appId === item.appId) }));
}

// アプリの一覧の1件の型です。配下のページを含みます。
export type AppRow = Awaited<ReturnType<typeof listApps>>[number];

// アプリの保存する値です。説明とアイコンは空なら未設定にします。
const appColumns = (values: z.infer<typeof appSchema>) => ({
  name: values.name,
  description: values.description || null,
  urlDomain: values.urlDomain,
  iconName: values.iconName || null,
});

// アプリを登録します。作成者・更新者はログイン中の利用者です。アプリ ID がすでに使われていたら false を返します。
export async function createApp(values: z.infer<typeof appSchema>) {
  const admin = await getAdmin();
  const now = new Date().toISOString();
  const created = await db
    .insert(app)
    .values({ appId: values.appId, ...appColumns(values), createdAt: now, createdBy: admin.sub, updatedAt: now, updatedBy: admin.sub })
    .onConflictDoNothing()
    .returning({ appId: app.appId });
  return created.length > 0;
}

// アプリを更新します。アプリ ID は変えません。
export async function updateApp(values: z.infer<typeof appSchema>) {
  const admin = await getAdmin();
  await db
    .update(app)
    .set({ ...appColumns(values), updatedAt: new Date().toISOString(), updatedBy: admin.sub })
    .where(eq(app.appId, values.appId));
}

// アプリを削除します。配下のページも一緒に削除されます。
export async function deleteApp(appId: string) {
  await getAdmin();
  await db.delete(app).where(eq(app.appId, appId));
}

// ページの保存する値です。説明と相対パスは空なら未設定にします。
const pageColumns = (values: z.infer<typeof pageSchema>) => ({
  name: values.name,
  description: values.description || null,
  relativePath: values.relativePath || null,
  role: values.role,
});

// ページを登録します。作成者・更新者はログイン中の利用者です。ページ ID がすでに使われていたら false を返します。
export async function createPage(values: z.infer<typeof pageSchema>) {
  const admin = await getAdmin();
  const now = new Date().toISOString();
  const created = await db
    .insert(page)
    .values({
      appId: values.appId,
      pageId: values.pageId,
      ...pageColumns(values),
      createdAt: now,
      createdBy: admin.sub,
      updatedAt: now,
      updatedBy: admin.sub,
    })
    .onConflictDoNothing()
    .returning({ pageId: page.pageId });
  return created.length > 0;
}

// ページを更新します。ページ ID は変えません。
export async function updatePage(values: z.infer<typeof pageSchema>) {
  const admin = await getAdmin();
  await db
    .update(page)
    .set({ ...pageColumns(values), updatedAt: new Date().toISOString(), updatedBy: admin.sub })
    .where(and(eq(page.appId, values.appId), eq(page.pageId, values.pageId)));
}

// ページを削除します。
export async function deletePage(appId: string, pageId: string) {
  await getAdmin();
  await db.delete(page).where(and(eq(page.appId, appId), eq(page.pageId, pageId)));
}

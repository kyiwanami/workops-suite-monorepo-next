import 'server-only';
import { db } from '@workops/server/db';
import { app, page, type userMembership } from '@workops/blocks/schema';
import { asc, ne } from 'drizzle-orm';
import { getMembership } from '@/user';

// ロールの強さの順です。ページの必要なロール以上のロールの利用者に、そのページを見せます。
const roleRanks: Record<typeof userMembership.$inferSelect['role'], number> = { viewer: 1, editor: 2, manager: 3 };

// ホームに並べるアプリと、ログイン中の利用者が使えるページを返します。ポータル自身は含めません。
// 全体管理者にはすべてのページを、それ以外には必要なロールが未設定か、自分のロール以下のページだけを返します。
export async function listHomeApps() {
  const membership = await getMembership();
  const [apps, pages] = await Promise.all([
    db
      .select({ appId: app.appId, name: app.name, description: app.description, urlDomain: app.urlDomain, iconName: app.iconName })
      .from(app)
      .where(ne(app.appId, 'portal'))
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
  const visiblePages = pages.filter(
    (item) =>
      membership?.isAdmin === true ||
      item.role === null ||
      (membership !== null && roleRanks[membership.role] >= roleRanks[item.role]),
  );
  return apps.map((item) => ({ ...item, pages: visiblePages.filter((child) => child.appId === item.appId) }));
}

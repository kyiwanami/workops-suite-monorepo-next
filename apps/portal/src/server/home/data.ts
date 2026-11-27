import 'server-only';
import { hasRole } from '@workops/domain/membership';
import { readApps } from '@/server/apps/data';
import { getMembership } from '@/server/user';

// ホームに並べるアプリと、ログイン中の利用者が使えるページを返します。ポータル自身は含めません。
// 全体管理者にはすべてのページを、それ以外には必要なロールが未設定か、自分のロール以下のページだけを返します。
export async function listHomeApps() {
  const [membership, apps] = await Promise.all([getMembership(), readApps()]);
  return apps
    .filter((item) => item.appId !== 'portal')
    .map((item) => ({ ...item, pages: item.pages.filter((child) => child.role === null || (membership !== null && hasRole(membership, child.role))) }));
}

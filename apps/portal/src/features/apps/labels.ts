import type { page } from '@workops/blocks/schema';

// ページを見るのに必要なロールの表示名です。all は必要なロールが未設定で、全員が見られることを表します。
export const pageRoleLabels: Record<'all' | (typeof page.role.enumValues)[number], string> = {
  all: '全員',
  viewer: '閲覧者以上',
  editor: '担当者以上',
  manager: '承認者以上',
};

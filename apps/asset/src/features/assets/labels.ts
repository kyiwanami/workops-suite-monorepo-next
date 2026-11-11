import type { asset } from '@workops/blocks/schema';

// 資産の状態の表示名と、Badge の色の種類です。
export const statusBadges: Record<
  typeof asset.$inferSelect['status'],
  { label: string; variant: 'success' | 'info' | 'warning' | 'outline' }
> = {
  inStock: { label: '在庫中', variant: 'success' },
  lent: { label: '貸出中', variant: 'info' },
  inRepair: { label: '修理中', variant: 'warning' },
  disposed: { label: '廃棄', variant: 'outline' },
};

// 日時を「2026/11/05 09:20」の形にします。
const dateTimeFormat = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

// DB の日時の文字列を、画面の日時の形にします。
export const formatDateTime = (value: string) => dateTimeFormat.format(new Date(value));

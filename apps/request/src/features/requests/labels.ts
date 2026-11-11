import type { request } from '@workops/blocks/schema';

// 申請の状態の表示名と、Badge の色の種類です。
export const statusBadges: Record<
  typeof request.$inferSelect['status'],
  { label: string; variant: 'secondary' | 'info' | 'success' | 'destructive' | 'outline' }
> = {
  draft: { label: '下書き', variant: 'secondary' },
  submitted: { label: '提出済み', variant: 'info' },
  approved: { label: '承認済み', variant: 'success' },
  rejected: { label: '却下済み', variant: 'destructive' },
  withdrawn: { label: '取下げ済み', variant: 'outline' },
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

// 金額の3桁区切りです。
const amountFormat = new Intl.NumberFormat('ja-JP');

// 金額を「¥38,400」の形にします。未入力は「—」です。
export const formatAmount = (value: number | null) => (value === null ? '—' : `¥${amountFormat.format(value)}`);

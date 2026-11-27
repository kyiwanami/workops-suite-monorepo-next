import type { AssetStatus } from '@workops/schema/assets';
import type { RequestStatus } from '@workops/schema/requests';
import type { badgeVariants } from '@workops/ui/components/badge';
import type { VariantProps } from 'class-variance-authority';

// 表示名と、Badge の見た目の種類です。
export type BadgeStyle = { label: string } & VariantProps<typeof badgeVariants>;

// 資産の状態の表示名と、Badge の色の種類です。資産カタログの画面とAIの確認カードで使います。
export const assetStatusBadges: Record<AssetStatus, BadgeStyle> = {
  inStock: { label: '在庫中', variant: 'success' },
  lent: { label: '貸出中', variant: 'info' },
  inRepair: { label: '修理中', variant: 'warning' },
  disposed: { label: '廃棄', variant: 'outline' },
};

// 申請の状態の表示名と、Badge の色の種類です。申請管理の画面とAIの確認カードで使います。
export const requestStatusBadges: Record<RequestStatus, BadgeStyle> = {
  draft: { label: '下書き', variant: 'secondary' },
  submitted: { label: '提出済み', variant: 'info' },
  approved: { label: '承認済み', variant: 'success' },
  rejected: { label: '却下済み', variant: 'destructive' },
  withdrawn: { label: '取下げ済み', variant: 'outline' },
};

// 日時の書式です。日本時間の「2026/11/05 09:20」の形にします。
const dateTimeFormat = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

// 日時を、日本時間の「2026/11/05 09:20」の形にします。
export const formatDateTime = (value: string | Date) => dateTimeFormat.format(new Date(value));

// 金額の書式です。円記号を半角の「¥」にするため、英語・日本の設定で通貨の書式にします。
const amountFormat = new Intl.NumberFormat('en-JP', { style: 'currency', currency: 'JPY' });

// 金額を「¥38,400」の形にします。未入力は「—」です。
export const formatAmount = (value: number | null) => (value === null ? '—' : amountFormat.format(value));

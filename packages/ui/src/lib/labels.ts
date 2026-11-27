import type { AssetDetail } from '@workops/schema/assets';
import type { RequestDetail } from '@workops/schema/requests';
import type { Badge } from '@workops/ui/components/badge';
import { tz } from '@date-fns/tz';
import { format } from 'date-fns';
import type { ComponentProps } from 'react';

// 資産の状態の表示名と、Badge の色の種類です。資産カタログの画面とAIの確認カードで使います。
export const assetStatusBadges: Record<AssetDetail['status'], { label: string; variant: ComponentProps<typeof Badge>['variant'] }> = {
  inStock: { label: '在庫中', variant: 'success' },
  lent: { label: '貸出中', variant: 'info' },
  inRepair: { label: '修理中', variant: 'warning' },
  disposed: { label: '廃棄', variant: 'outline' },
};

// 申請の状態の表示名と、Badge の色の種類です。申請管理の画面とAIの確認カードで使います。
export const requestStatusBadges: Record<RequestDetail['status'], { label: string; variant: ComponentProps<typeof Badge>['variant'] }> = {
  draft: { label: '下書き', variant: 'secondary' },
  submitted: { label: '提出済み', variant: 'info' },
  approved: { label: '承認済み', variant: 'success' },
  rejected: { label: '却下済み', variant: 'destructive' },
  withdrawn: { label: '取下げ済み', variant: 'outline' },
};

// DB の日時の文字列を、日本時間の「2026/11/05 09:20」の形にします。
export const formatDateTime = (value: string) => format(new Date(value), 'yyyy/MM/dd HH:mm', { in: tz('Asia/Tokyo') });

// 金額の書式です。円記号を半角の「¥」にするため、英語・日本の設定で通貨の書式にします。
const amountFormat = new Intl.NumberFormat('en-JP', { style: 'currency', currency: 'JPY' });

// 金額を「¥38,400」の形にします。未入力は「—」です。
export const formatAmount = (value: number | null) => (value === null ? '—' : amountFormat.format(value));

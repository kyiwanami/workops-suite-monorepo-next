import type { BadgeStyle } from '@workops/ui/lib/labels';
import type { AccountStatus } from './schema';

// アカウントの状態の表示名と、Badge の色の種類です。
export const statusBadges: Record<AccountStatus, BadgeStyle> = {
  invited: { label: '招待中', variant: 'info' },
  active: { label: '有効', variant: 'success' },
  disabled: { label: '無効', variant: 'outline' },
};

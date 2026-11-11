import type { AccountStatus } from './data';

// アカウントの状態の表示名と、Badge の色の種類です。
export const statusBadges: Record<AccountStatus, { label: string; variant: 'info' | 'success' | 'outline' }> = {
  invited: { label: '招待中', variant: 'info' },
  active: { label: '有効', variant: 'success' },
  disabled: { label: '無効', variant: 'outline' },
};

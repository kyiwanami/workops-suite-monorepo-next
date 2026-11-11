import type { z } from 'zod';
import type { accountStatus } from './schema';

// アカウントの状態の表示名と、Badge の色の種類です。
export const statusBadges: Record<z.infer<typeof accountStatus>, { label: string; variant: 'info' | 'success' | 'outline' }> = {
  invited: { label: '招待中', variant: 'info' },
  active: { label: '有効', variant: 'success' },
  disabled: { label: '無効', variant: 'outline' },
};

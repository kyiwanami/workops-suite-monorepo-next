import type { ReactNode } from 'react';
import { getManager } from '@/features/request-types/data';

// 申請種別の画面は承認者以上だけが開けます。
export default async function RequestTypesLayout({ children }: { children: ReactNode }) {
  await getManager();
  return children;
}

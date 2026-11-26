import type { ReactNode } from 'react';
import { getManager } from '@/server/asset-types/data';

// 資産種別の画面は承認者以上だけが開けます。
export default async function AssetTypesLayout({ children }: { children: ReactNode }) {
  await getManager();
  return children;
}

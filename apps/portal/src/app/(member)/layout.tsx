import { getMembership } from '@/user';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

// 所属が未設定の利用者を、設定が必要なことを伝える画面へ転送します。
export default async function MemberLayout({ children }: { children: ReactNode }) {
  const membership = await getMembership();
  if (membership === null) {
    redirect('/setup-required');
  }
  return children;
}

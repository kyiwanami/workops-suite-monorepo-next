import { getMembership } from '@/user';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

// 所属が未設定の利用者を、設定が必要なことを伝える画面へ転送します。
// 本文は最大幅 1200px で中央に置き、画面端の余白を広い画面で 24px、狭い画面で 16px にします。
export default async function MemberLayout({ children }: { children: ReactNode }) {
  const membership = await getMembership();
  if (membership === null) {
    redirect('/setup-required');
  }
  return <main className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 md:px-6">{children}</main>;
}

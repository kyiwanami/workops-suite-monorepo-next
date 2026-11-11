import type { ReactNode } from 'react';
import { getMember } from '@/user';

// 申請管理の画面の枠です。所属を確かめ、本文は最大幅 1200px で中央に置き、画面端の余白を広い画面で 24px、狭い画面で 16px にします。
export default async function MemberLayout({ children }: { children: ReactNode }) {
  await getMember();
  return <main className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 md:px-6">{children}</main>;
}

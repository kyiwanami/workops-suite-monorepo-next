import { getAdmin } from '@/user';
import type { ReactNode } from 'react';
import { AdminTabs } from './admin-tabs';

// 管理の画面の枠です。全体管理者だけが開け、上に管理の画面を切り替えるタブを置きます。
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await getAdmin();
  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}

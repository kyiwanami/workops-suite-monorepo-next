import { redirect } from 'next/navigation';

// アプリの一覧を作るまでは、部署の一覧へ転送します。
export default function HomePage() {
  redirect('/admin/departments');
}

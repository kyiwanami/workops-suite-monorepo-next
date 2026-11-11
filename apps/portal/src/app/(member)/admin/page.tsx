import { redirect } from 'next/navigation';

// 管理の入口は、ユーザーの一覧です。
export default function AdminPage() {
  redirect('/admin/users');
}

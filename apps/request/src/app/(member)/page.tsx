import { redirect } from 'next/navigation';

// 申請管理の入口は、申請の一覧です。
export default function HomePage() {
  redirect('/requests');
}

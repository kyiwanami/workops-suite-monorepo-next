import { redirect } from 'next/navigation';

// 資産カタログの入口は、資産の一覧です。
export default function HomePage() {
  redirect('/assets');
}

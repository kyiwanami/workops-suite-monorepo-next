import { getEmail } from '@/user';

// 申請管理のトップページです。ログイン中の利用者のメールを表示します。
export default async function HomePage() {
  const email = await getEmail();
  return (
    <main>
      <h1>申請管理</h1>
      <p>{email}</p>
    </main>
  );
}

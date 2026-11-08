import { getEmail } from '@/user';

// 資産カタログのトップページです。ログイン中の利用者のメールを表示します。
export default async function HomePage() {
  const email = await getEmail();
  return (
    <main>
      <h1>資産カタログ</h1>
      <p>{email}</p>
    </main>
  );
}

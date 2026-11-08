import Link from 'next/link';

// 権限外と存在しないを区別せずに表示し、アプリの一覧へ戻します。
export default function NotFound() {
  return (
    <main>
      <p>ページが見つからないか、権限がありません。</p>
      <Link href="/">アプリの一覧へ戻る</Link>
    </main>
  );
}

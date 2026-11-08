import type { ReactNode } from 'react';

// ポータルの全画面に共通の枠です。
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

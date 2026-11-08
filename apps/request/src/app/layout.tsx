import type { ReactNode } from 'react';

// 申請管理の全画面に共通の枠です。
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

// OS の設定に従ってライトとダークを切り替えます。ユーザーメニューで選んだテーマはブラウザに保存します。
// 切り替えのスクリプトは、CSP の nonce を付けて動かします。CSP を付けない要求では nonce がありません。
export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce: string | undefined }) {
  return (
    <NextThemesProvider {...(nonce === undefined ? {} : { nonce })} attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

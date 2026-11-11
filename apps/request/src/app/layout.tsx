import '@workops/ui/globals.css';
import { ThemeProvider } from '@workops/ui/workops/theme-provider';
import { BIZ_UDGothic, BIZ_UDPGothic } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';
import { Header } from '@/header';

// 本文と画面の文字に使う書体と、金額・日時の数字に使う等幅の書体です。
const bizUdpGothic = BIZ_UDPGothic({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-biz-udpgothic' });
const bizUdGothic = BIZ_UDGothic({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-biz-udgothic' });

// 申請管理の全画面に共通の枠です。共通のヘッダーを上に置き、検索条件を URL で扱えるようにします。
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className={`${bizUdpGothic.variable} ${bizUdGothic.variable} font-sans`} suppressHydrationWarning>
      <body>
        <NuqsAdapter>
          <ThemeProvider>
            <Header />
            {children}
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}

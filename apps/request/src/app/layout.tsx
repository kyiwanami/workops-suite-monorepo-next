import '@workops/ui/globals.css';
import { nonce } from '@nosecone/next';
import { chatApiUrl } from '@workops/server/chat';
import { ChatLauncher, ChatPanel, ChatProvider } from '@workops/ui/workops/chat/chat-panel';
import { ThemeProvider } from '@workops/ui/workops/theme-provider';
import { BIZ_UDGothic, BIZ_UDPGothic } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { type ReactNode, Suspense } from 'react';
import { Header } from '@/header';

// 本文と画面の文字に使う書体と、金額・日時の数字に使う等幅の書体です。
const bizUdpGothic = BIZ_UDPGothic({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-biz-udpgothic' });
const bizUdGothic = BIZ_UDGothic({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-biz-udgothic' });

// 申請管理の全画面に共通の枠です。共通のヘッダーを上に置き、ヘッダーの読み込みを待たずに本文の読み込み中の表示を出し、検索条件を URL で扱えるようにします。
// 画面右下に「AIに頼む」を置き、AIのパネルは本文の右に開きます。表のページ送りがボタンと重ならないよう、本文の下に 72px の余白を取ります。
export default async function RootLayout({ children }: { children: ReactNode }) {
  // proxy.ts が要求ごとに作った CSP の nonce です。
  const scriptNonce = await nonce();
  return (
    <html lang="ja" className={`${bizUdpGothic.variable} ${bizUdGothic.variable} font-sans`} suppressHydrationWarning>
      <body>
        <NuqsAdapter>
          <ThemeProvider nonce={scriptNonce}>
            <ChatProvider chatApiUrl={chatApiUrl}>
              <Suspense>
                <Header />
              </Suspense>
              <div className="flex">
                <div className="min-w-0 flex-1 pb-18">{children}</div>
                <ChatPanel />
              </div>
              <ChatLauncher />
            </ChatProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}

'use client';

import { Chat as AiChat } from '@ai-sdk/react';
import { dataPartSchemas } from '@workops/schema/chat';
import { Button } from '@workops/ui/components/button';
import { Sheet, SheetContent, SheetTitle } from '@workops/ui/components/sheet';
import { useIsMobile } from '@workops/ui/hooks/use-mobile';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import type { ChatMessage } from './chat';
import { HistoryIcon, PlusIcon, XIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AiGlyph } from './ai-glyph';
import { chatFetch } from './chat-fetch';

// 会話と会話の一覧の部品です。Markdown の表示を含むため、パネルを開いたときに読み込みます。
const Chat = dynamic(() => import('./chat').then((module) => module.Chat));
const ConversationList = dynamic(() => import('./conversation-list').then((module) => module.ConversationList));

// AIのパネルの開閉と、進めている会話です。起動ボタンとパネルで共有します。
const PanelContext = createContext<{
  chatApiUrl: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  chat: AiChat<ChatMessage>;
  openChat: (id: string, messages: ChatMessage[]) => void;
} | null>(null);

function usePanel() {
  const panel = useContext(PanelContext);
  if (panel === null) {
    throw new Error('ChatProvider の中で使います。');
  }
  return panel;
}

// AIのパネルの開閉と会話を、起動ボタンとパネルで共有します。最初は閉じておき、新しい会話を用意します。
// 会話はここで持ち、画面の幅をまたいでパネルの形が変わっても残します。
// チャットのAPIには、会話のIDと最後のメッセージだけを送ります。確認カードの判断がそろったら、自動で送ります。
export function ChatProvider({ chatApiUrl, children }: { chatApiUrl: string; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const createChat = (id: string, messages: ChatMessage[]) =>
    new AiChat<ChatMessage>({
      id,
      messages,
      dataPartSchemas,
      transport: new DefaultChatTransport({
        api: new URL('chat', chatApiUrl).href,
        fetch: chatFetch,
        prepareSendMessagesRequest: ({ id, messages }) => ({ body: { id, message: messages.at(-1) } }),
      }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
      // 書込みのツールを実行したら、開いているページを読み直して結果を表示します。
      onData: (part) => {
        if (part.type === 'data-result') {
          router.refresh();
        }
      },
    });
  // 新しい会話のIDは画面で作ります。
  const [chat, setChat] = useState(() => createChat(crypto.randomUUID(), []));
  return (
    <PanelContext.Provider
      value={{
        chatApiUrl,
        open,
        setOpen,
        chat,
        // 替える前に今の会話の受け取りを止める（外から渡した会話は useChat が止めない）
        openChat: (id, messages) => {
          void chat.stop();
          setChat(createChat(id, messages));
        },
      }}
    >
      {children}
    </PanelContext.Provider>
  );
}

// 画面右下の「AIに頼む」ボタンです。パネルを開いている間は隠し、閉じたらこのボタンにフォーカスを戻します。
// 丸いアイコンだけにはしません。サポート窓口のチャットと誤認されず、AIで業務を操作できると伝わるようにするためです。
export function ChatLauncher() {
  const { open, setOpen } = usePanel();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      buttonRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);
  if (open) {
    return null;
  }
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setOpen(true)}
      className="fixed right-6 bottom-6 z-30 inline-flex h-11 items-center gap-2 rounded-full bg-card pr-3 pl-4 text-sm font-bold text-foreground shadow-panel outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <AiGlyph />
      AIに頼む
    </button>
  );
}

// パネルの中身です。見出し（AIの印・会話の一覧・新しい会話・閉じる）、会話、会話の一覧です。
// 一覧を見ている間も進めている会話を残すため、会話は隠すだけにします。
function PanelBody() {
  const { chatApiUrl, setOpen, chat, openChat } = usePanel();
  const [listing, setListing] = useState(false);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b py-3 pr-3 pl-4">
        <AiGlyph />
        <h2 className="mr-auto ml-1 font-bold">AIアシスタント</h2>
        <Button variant={listing ? 'secondary' : 'ghost'} size="icon" onClick={() => setListing(!listing)}>
          <HistoryIcon />
          <span className="sr-only">会話の一覧</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            openChat(crypto.randomUUID(), []);
            setListing(false);
          }}
        >
          <PlusIcon />
          <span className="sr-only">新しい会話</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
          <XIcon />
          <span className="sr-only">閉じる</span>
        </Button>
      </div>
      {listing && (
        <ConversationList
          chatApiUrl={chatApiUrl}
          onOpen={(opened) => {
            openChat(opened.id, opened.messages);
            setListing(false);
          }}
        />
      )}
      <div className={listing ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        <Chat key={chat.id} chat={chat} />
      </div>
    </div>
  );
}

// AIアシスタントと会話するパネルです。閉じても会話は残します。
// - 1280px 以上：ページを隠さず、右に幅 400px で並べます。一覧を見ながら依頼できるようにするためです。高さはヘッダー（h-14）を除いた画面の高さです
// - 1280px 未満：一覧の列が詰まって読めなくならないよう、ページの上に重ねます
// - スマートフォン：下から全画面のシートで開きます
export function ChatPanel() {
  const { open, setOpen } = usePanel();
  const mobile = useIsMobile();
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (open) {
      setOpened(true);
    }
  }, [open]);

  // 一度開くまでは描きません。閉じたあとは、会話を残すため隠すだけにします。
  if (!opened) {
    return null;
  }
  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 bg-card p-0 data-[side=bottom]:h-svh">
          <SheetTitle className="sr-only">AIアシスタント</SheetTitle>
          <PanelBody />
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <aside
      className={
        open
          ? 'fixed top-4 right-4 bottom-4 z-40 w-[400px] overflow-hidden rounded-lg bg-card shadow-panel xl:sticky xl:top-0 xl:h-[calc(100svh-3.5rem)] xl:shrink-0 xl:rounded-none xl:border-l xl:shadow-none'
          : 'hidden'
      }
    >
      <PanelBody />
    </aside>
  );
}

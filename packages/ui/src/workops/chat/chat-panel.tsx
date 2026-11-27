'use client';

import { Button } from '@workops/ui/components/button';
import { Sheet, SheetContent, SheetTitle } from '@workops/ui/components/sheet';
import { useIsMobile } from '@workops/ui/hooks/use-mobile';
import type { ChatMessage } from './chat';
import { HistoryIcon, PlusIcon, XIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AiGlyph } from './ai-glyph';

// 会話と会話の一覧の部品です。AI SDK と Markdown の表示を含むため、パネルを開いたときに読み込みます。
const Chat = dynamic(() => import('./chat').then((module) => module.Chat));
const ConversationList = dynamic(() => import('./conversation-list').then((module) => module.ConversationList));

// AIのパネルの開閉です。起動ボタンとパネルで共有します。
const PanelContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

function usePanel() {
  const panel = useContext(PanelContext);
  if (panel === null) {
    throw new Error('ChatProvider の中で使います。');
  }
  return panel;
}

// AIのパネルの開閉を、起動ボタンとパネルで共有します。最初は閉じておきます。
export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <PanelContext.Provider value={{ open, setOpen }}>{children}</PanelContext.Provider>;
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

// 新しい会話です。会話のIDは画面で作ります。
function newConversation(): { id: string; messages: ChatMessage[] } {
  return { id: crypto.randomUUID(), messages: [] };
}

// パネルの中身です。見出し（AIの印・会話の一覧・新しい会話・閉じる）、会話、会話の一覧です。
// 一覧を見ている間も進めている会話を残すため、会話は隠すだけにします。
function PanelBody({ chatApiUrl }: { chatApiUrl: string }) {
  const { setOpen } = usePanel();
  const [conversation, setConversation] = useState(newConversation);
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
            setConversation(newConversation());
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
            setConversation(opened);
            setListing(false);
          }}
        />
      )}
      <div className={listing ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        <Chat key={conversation.id} chatApiUrl={chatApiUrl} id={conversation.id} messages={conversation.messages} />
      </div>
    </div>
  );
}

// AIアシスタントと会話するパネルです。閉じても会話は残します。
// - 1280px 以上：ページを隠さず、右に幅 400px で並べます。一覧を見ながら依頼できるようにするためです。高さはヘッダー（h-14）を除いた画面の高さです
// - 1280px 未満：一覧の列が詰まって読めなくならないよう、ページの上に重ねます
// - スマートフォン：下から全画面のシートで開きます
export function ChatPanel({ chatApiUrl }: { chatApiUrl: string }) {
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
          <PanelBody chatApiUrl={chatApiUrl} />
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
      <PanelBody chatApiUrl={chatApiUrl} />
    </aside>
  );
}

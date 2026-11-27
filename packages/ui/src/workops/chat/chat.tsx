'use client';

import { type Chat as AiChat, useChat } from '@ai-sdk/react';
import { Alert, AlertAction, AlertDescription } from '@workops/ui/components/alert';
import { Bubble, BubbleContent } from '@workops/ui/components/bubble';
import { Button } from '@workops/ui/components/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@workops/ui/components/input-group';
import { Message, MessageContent } from '@workops/ui/components/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@workops/ui/components/message-scroller';
import { Spinner } from '@workops/ui/components/spinner';
import type { dataPartSchemas } from '@workops/schema/chat';
import { type InferUIDataParts, isDynamicToolUIPart, isTextUIPart, type UIMessage } from 'ai';
import { SendIcon } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';
import { toolTitle, ToolPart } from './tool-part';

// 確認カードのデータパート（対象の値と実行の日時）の型を付けた、AI SDK のメッセージです。
export type ChatMessage = UIMessage<never, InferUIDataParts<typeof dataPartSchemas>>;

// 待っている間の表示です。何をしているかを書き、擬人化した言い方はしません。
// 実行中のツールがあればその表示名で、なければ回答を作っていると書きます。
function waitingText(messages: ChatMessage[]) {
  const part = messages.at(-1)?.parts.filter(isDynamicToolUIPart).at(-1);
  if (part === undefined || part.state === 'output-available' || part.state === 'output-error') {
    return '回答を作っています…';
  }
  if (part.providerExecuted === true) {
    return `${toolTitle(part)}を確認しています…`;
  }
  return `${toolTitle(part)}を実行しています…`;
}

// AIとの1つの会話です。依頼を送り、回答を逐次表示し、書込みのツールは確認カードで確定させます。
export function Chat({ chat }: { chat: AiChat<ChatMessage> }) {
  const { messages, sendMessage, addToolApprovalResponse, status, stop, error, regenerate } = useChat({ chat });
  const [text, setText] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const busy = status === 'submitted' || status === 'streaming';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || text === '') {
      return;
    }
    void sendMessage({ text });
    setText('');
  }

  return (
    <MessageScrollerProvider autoScroll>
      <div className="flex min-h-0 flex-1 flex-col">
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-4 p-4 text-sm leading-[22px]">
              {/* 最初の回答として、AIで何ができるかと、書き換える前に必ず確認することを伝えます。 */}
              <p>資産と申請について、検索や登録・更新、申請の作成・提出・承認などを頼めます。書き換える前に、必ず内容を確認していただきます。</p>
              {messages.map((message) =>
                message.role === 'user' ? (
                  <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor>
                    <Message align="end">
                      <MessageContent>
                        <Bubble align="end" variant="secondary" className="max-w-[85%]">
                          <BubbleContent className="whitespace-pre-wrap">
                            {message.parts
                              .filter(isTextUIPart)
                              .map((part) => part.text)
                              .join('\n')}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ) : (
                  // AIの回答は吹き出しにせず、箇条書きや一覧を読めるようパネルの全幅に本文として表示します。
                  <MessageScrollerItem key={message.id} messageId={message.id}>
                    {/* 読み上げは最新の回答だけにし、長い履歴を一度に読み上げないようにします。作っている間は読み上げを待たせ、できあがってから読み上げます。 */}
                    <div className="flex flex-col gap-3" {...(message === messages.at(-1) ? { 'aria-live': 'polite', 'aria-busy': busy } : {})}>
                      {message.parts.map((part, index) => {
                        if (part.type === 'text') {
                          return (
                            <Streamdown key={index} isAnimating={busy && message === messages.at(-1)}>
                              {part.text}
                            </Streamdown>
                          );
                        }
                        if (part.type === 'dynamic-tool') {
                          // BFF が添えた、カードを表示した時点の対象の値と、入力の ID の項目の名前と、実行の日時です。
                          const target = message.parts.flatMap((item) => (item.type === 'data-target' && item.id === part.toolCallId ? [item.data] : [])).at(0);
                          const names = message.parts.flatMap((item) => (item.type === 'data-names' && item.id === part.toolCallId ? [item.data] : [])).at(0);
                          const resultAt = message.parts.flatMap((item) => (item.type === 'data-result' && item.id === part.toolCallId ? [item.data.at] : [])).at(0);
                          return <ToolPart key={part.toolCallId} part={part} target={target} names={names} resultAt={resultAt} onRespond={addToolApprovalResponse} />;
                        }
                        return null;
                      })}
                    </div>
                  </MessageScrollerItem>
                ),
              )}
              {/* 待っている間の表示を読み上げます。領域を先に置いておき、表示が出たときに読み上げられるようにします。 */}
              <div aria-live="polite">
                {busy && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Spinner />
                    {waitingText(messages)}
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void stop()}>
                      中止
                    </Button>
                  </div>
                )}
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>回答を作れませんでした。もう一度お試しください。</AlertDescription>
                  <AlertAction>
                    <Button size="sm" variant="outline" onClick={() => void regenerate()}>
                      再試行
                    </Button>
                  </AlertAction>
                </Alert>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
        <form ref={formRef} onSubmit={onSubmit} className="border-t p-3">
          <InputGroup>
            <InputGroupTextarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="資産や申請について質問・依頼する"
              className="max-h-40 min-h-10"
              onKeyDown={(event) => {
                // Enter で送り、Shift + Enter で改行します。日本語の変換を確定する Enter では送りません。
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
            />
            {/* 送信は ghost のボタンにし、入力があるときだけアイコンを primary の色にします。パネルを開いても、画面の塗りのボタンを1つのままにするためです。 */}
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="ghost" size="icon-sm" disabled={busy || text === ''} className={text === '' ? undefined : 'text-primary'}>
                <SendIcon />
                <span className="sr-only">送信</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>
    </MessageScrollerProvider>
  );
}

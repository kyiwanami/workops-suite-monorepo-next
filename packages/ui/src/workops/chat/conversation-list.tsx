'use client';

import { Spinner } from '@workops/ui/components/spinner';
import { formatDateTime } from '@workops/ui/lib/labels';
import { conversationSchema, conversationsSchema, dataPartSchemas } from '@workops/schema/chat';
import { validateUIMessages } from 'ai';
import type { ChatMessage } from './chat';
import { MessageSquareIcon } from 'lucide-react';
import useSWR from 'swr';
import { chatFetch } from './chat-fetch';

// 利用者の過去の会話の一覧です。選んだ会話の履歴を読み、その会話を開きます。
// 一覧と履歴を読めなかったときは、内容をコンソールに出し、一覧を空にします。
export function ConversationList({
  chatApiUrl,
  onOpen,
}: {
  chatApiUrl: string;
  onOpen: (conversation: { id: string; messages: ChatMessage[] }) => void;
}) {
  // 一覧は SWR で読みます。一覧を開くたびに、前に読んだ一覧を出しながら読み直します。
  const { data, error } = useSWR(
    new URL('conversations', chatApiUrl).href,
    async (url: string) => {
      const response = await chatFetch(url);
      if (!response.ok) {
        throw new Error(`会話の一覧を読めませんでした（${response.status}）。`);
      }
      return conversationsSchema.parse(await response.json()).conversations;
    },
    { onError: (error) => console.error(error) },
  );
  const conversations = error === undefined ? data : [];

  // 会話の履歴を AI SDK のメッセージとして読み、会話を開きます。
  async function open(id: string) {
    const response = await chatFetch(new URL(`conversations/${id}`, chatApiUrl));
    if (!response.ok) {
      throw new Error(`会話の履歴を読めませんでした（${response.status}）。`);
    }
    const { messages } = conversationSchema.parse(await response.json());
    onOpen({ id, messages: await validateUIMessages<ChatMessage>({ messages, dataSchemas: dataPartSchemas }) });
  }

  if (conversations === undefined) {
    return <Spinner className="mx-auto my-6" />;
  }
  if (conversations.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">過去の会話はありません。</p>;
  }
  return (
    <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      {conversations.map((conversation) => (
        <li key={conversation.conversationId}>
          <button
            type="button"
            onClick={() => void open(conversation.conversationId).catch((error) => console.error(error))}
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm outline-ring hover:bg-accent focus-visible:outline-2"
          >
            <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-mono">{formatDateTime(conversation.createdAt)}</span>
            に始めた会話
          </button>
        </li>
      ))}
    </ul>
  );
}

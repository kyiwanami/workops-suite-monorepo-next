import { z } from 'zod';

// チャットに送る要求です。AI SDK の画面から、会話のIDと最後のメッセージだけを送ります。
// メッセージは、利用者の依頼か、確認カードの判断を付けたAIの発話です。中身は受け取る側が AI SDK で検証します。
export const chatSchema = z.object({
  id: z.uuid().meta({ description: '会話のID' }),
  message: z.json().meta({ description: '最後のメッセージ' }),
});

// 画面のサーバーが返す、チャットのAPIを呼ぶためのトークンです。
export const chatTokenSchema = z.object({
  accessToken: z.string().meta({ description: '利用者のアクセストークン' }),
});

// チャットのAPIが返す、利用者の会話の一覧です。新しい順に並びます。
export const conversationsSchema = z.object({
  conversations: z.array(
    z.object({
      conversationId: z.uuid().meta({ description: '会話のID' }),
      createdAt: z.iso.datetime().meta({ description: '会話を始めた日時' }),
    }),
  ),
});

// チャットのAPIが返す、会話の履歴です。中身は受け取る側が AI SDK で検証します。
export const conversationSchema = z.object({
  messages: z.array(z.json()).meta({ description: 'AI SDK のメッセージ' }),
});

// 確認カードに添えるデータパートです。BFF が送り、画面が AI SDK で検証します。
// - target：確認カードを表示した時点の対象の値（読み取りツールの結果）
// - names：入力の ID の項目の名前。項目名から名前を引きます
// - result：書込みのツールを実行した日時
export const dataPartSchemas = {
  target: z.record(z.string(), z.json()).meta({ description: '確認カードを表示した時点の対象の値' }),
  names: z.record(z.string(), z.string()).meta({ description: '入力の ID の項目の名前' }),
  result: z.object({
    at: z.string().meta({ description: '書込みのツールを実行した日時' }),
  }),
};

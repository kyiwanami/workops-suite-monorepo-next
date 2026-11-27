import { z } from 'zod';

// チャットに送る要求です。AI SDK の画面から、会話のIDと最後のメッセージだけを送ります。
// メッセージは、利用者の依頼か、確認カードの承認・キャンセルを付けたAIの発話です。中身は受け取る側が AI SDK で検証します。
export const chatSchema = z.object({
  id: z.uuid().describe('会話のID'),
  message: z.json().describe('最後のメッセージ'),
});

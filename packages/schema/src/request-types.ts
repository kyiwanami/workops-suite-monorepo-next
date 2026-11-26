import { z } from 'zod';

// 申請種別の登録・編集フォームの入力です。画面とサーバーの両方で検証します。
// 表示順は数の入力欄で、空のときも同じ文言を出します。説明は、AIツールの入力の説明にも使います。
export const requestTypeSchema = z.object({
  code: z.string().min(1, 'コードを入力してください。').describe('申請種別のコード'),
  name: z.string().min(1, '種別名を入力してください。').describe('申請種別の名前'),
  description: z.string().nullable().describe('申請種別の説明'),
  sortOrder: z.number({ error: '表示順は整数で入力してください。' }).int('表示順は整数で入力してください。').describe('表示順'),
});

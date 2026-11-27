import { z } from 'zod';

// 申請種別の登録・編集フォームの入力です。画面とサーバーの両方で検証します。
// 表示順は数の入力欄で、空のときも同じ文言を出します。
export const requestTypeSchema = z.object({
  code: z
    .string()
    .min(1, 'コードを入力してください。')
    .meta({ description: '申請種別のコード' }),
  name: z
    .string()
    .min(1, '種別名を入力してください。')
    .meta({ description: '申請種別の名前' }),
  description: z
    .string()
    .nullable()
    .meta({ description: '申請種別の説明' }),
  sortOrder: z
    .number({ error: '表示順は整数で入力してください。' })
    .int('表示順は整数で入力してください。')
    .meta({ description: '表示順' }),
});

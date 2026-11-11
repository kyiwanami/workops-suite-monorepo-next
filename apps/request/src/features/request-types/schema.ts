import { requestType } from '@workops/blocks/schema';
import { createInsertSchema } from 'drizzle-orm/zod';
import { z } from 'zod';

// 申請種別の登録・編集フォームの入力です。申請種別のテーブルの列から作り、入力の検証を足します。画面とサーバーの両方で検証します。
// 表示順は数の入力欄で、空のときも同じ文言を出すため差し替えます。
export const requestTypeSchema = createInsertSchema(requestType, {
  code: (schema) => schema.min(1, 'コードを入力してください。'),
  name: (schema) => schema.min(1, '種別名を入力してください。'),
})
  .pick({ code: true, name: true, description: true })
  .required()
  .extend({
    sortOrder: z.number({ error: '表示順は整数で入力してください。' }).int('表示順は整数で入力してください。'),
  });

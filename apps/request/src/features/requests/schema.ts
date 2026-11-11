import { request } from '@workops/blocks/schema';
import { createInsertSchema } from 'drizzle-orm/zod';
import { z } from 'zod';

// 申請の作成・編集フォームの入力です。申請のテーブルの列から作り、入力の検証を足します。画面とサーバーの両方で検証します。
// 種別は未選択の空から選ぶため、選んだかどうかで検証します。金額は任意の整数で、未入力は null です。
export const requestSchema = createInsertSchema(request, {
  title: (schema) => schema.min(1, '件名を入力してください。'),
})
  .pick({ title: true, description: true })
  .required()
  .extend({
    requestTypeId: z.string().min(1, '申請種別を選んでください。'),
    amount: z.number({ error: '金額は整数で入力してください。' }).int('金額は整数で入力してください。').nullable(),
  });

// 却下・差戻しの理由の入力です。
export const reasonSchema = z.object({
  reason: z.string().min(1, '理由を入力してください。'),
});

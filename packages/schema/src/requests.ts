import { request } from '@workops/blocks/schema';
import { createInsertSchema } from 'drizzle-orm/zod';
import { z } from 'zod';

// 申請の作成・編集フォームの入力です。申請のテーブルの列から作り、入力の検証を足します。画面とサーバーの両方で検証します。
// 種別は未選択の空から選ぶため、選んだかどうかで検証します。金額は任意の整数で、未入力は null です。
// 説明は、AIツールの入力の説明にも使います。
export const requestSchema = createInsertSchema(request, {
  title: (schema) => schema.min(1, '件名を入力してください。').describe('申請の件名'),
  description: (schema) => schema.describe('申請の説明'),
})
  .pick({ title: true, description: true })
  .required()
  .extend({
    requestTypeId: z.string().min(1, '申請種別を選んでください。').describe('申請種別のID。有効な種別だけを選べる'),
    amount: z
      .number({ error: '金額は整数で入力してください。' })
      .int('金額は整数で入力してください。')
      .nullable()
      .describe('金額（円）。なければ null'),
  });

// 却下・差戻しの理由の入力です。
export const reasonSchema = z.object({
  reason: z.string().min(1, '理由を入力してください。').describe('却下・差戻しの理由'),
});

// 申請の一覧のタブです。すべて・自分が承認するもの・自分の申請です。
export const requestTabs = ['all', 'approve', 'mine'] as const;

// 申請の一覧の期間です。作成日時が今月・先月のもの、またはすべてです。
export const requestPeriods = ['thisMonth', 'lastMonth', 'all'] as const;

// 申請の一覧の検索条件です。画面ではURLのクエリ文字列から作ります。
export const requestConditionsSchema = z.object({
  tab: z.enum(requestTabs).describe('all：すべて、approve：自分が承認するもの（承認者以上）、mine：自分の申請'),
  q: z.string().nullable().describe('件名、または申請者の名前・メールの部分一致'),
  type: z.string().nullable().describe('申請種別のID'),
  period: z.enum(requestPeriods).describe('作成日時の期間。thisMonth：今月、lastMonth：先月、all：すべて'),
  department: z.string().nullable().describe('部署のID。全体管理者だけに効く'),
  page: z.number().int().min(1).describe('ページ番号（1から）'),
});

// 申請の一覧の検索条件の型です。
export type RequestConditions = z.infer<typeof requestConditionsSchema>;

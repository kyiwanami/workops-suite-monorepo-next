import { asset } from '@workops/blocks/schema';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import { z } from 'zod';

// 資産の状態です。資産のテーブルの状態の列から作ります。
export const assetStatus = createSelectSchema(asset).shape.status;

// 資産の登録・編集フォームの入力です。資産のテーブルの列から作り、入力の検証を足します。画面とサーバーの両方で検証します。
// 部署と種別は未選択の空から選ぶため、選んだかどうかで検証します。担当者が未設定なら未割当です。
// 説明は、AIツールの入力の説明にも使います。
export const assetSchema = createInsertSchema(asset, {
  name: (schema) => schema.min(1, '名称を入力してください。').describe('資産の名称'),
  status: (schema) => schema.describe('資産の状態'),
  assigneeSub: (schema) => schema.describe('担当者の利用者識別子。未割当なら null'),
})
  .pick({ name: true, status: true, assigneeSub: true })
  .required()
  .extend({
    departmentId: z.string().min(1, '部署を選んでください。').describe('部署のID。全体管理者以外は自部署に登録される'),
    assetTypeId: z.string().min(1, '種別を選んでください。').describe('資産種別のID'),
  });

// 資産の一覧の検索条件です。画面ではURLのクエリ文字列から作ります。
export const assetConditionsSchema = z.object({
  q: z.string().nullable().describe('資産の名称、または担当者の名前・メールの部分一致'),
  status: assetStatus.nullable().describe('資産の状態'),
  type: z.string().nullable().describe('資産種別のID'),
  department: z.string().nullable().describe('部署のID。全体管理者だけに効く'),
  page: z.number().int().min(1).describe('ページ番号（1から）'),
});

// 資産の一覧の検索条件の型です。
export type AssetConditions = z.infer<typeof assetConditionsSchema>;

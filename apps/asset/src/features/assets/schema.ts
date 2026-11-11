import { asset } from '@workops/blocks/schema';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import { z } from 'zod';

// 資産の状態です。資産のテーブルの状態の列から作ります。
export const assetStatus = createSelectSchema(asset).shape.status;

// 資産の登録・編集フォームの入力です。資産のテーブルの列から作り、入力の検証を足します。画面とサーバーの両方で検証します。
// 部署と種別は未選択の空から選ぶため、選んだかどうかで検証します。担当者が未設定なら未割当です。
export const assetSchema = createInsertSchema(asset, {
  name: (schema) => schema.min(1, '名称を入力してください。'),
})
  .pick({ name: true, status: true, assigneeSub: true })
  .required()
  .extend({
    departmentId: z.string().min(1, '部署を選んでください。'),
    assetTypeId: z.string().min(1, '種別を選んでください。'),
  });

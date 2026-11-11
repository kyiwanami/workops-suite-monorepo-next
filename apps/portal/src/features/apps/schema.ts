import { app, page } from '@workops/blocks/schema';
import { createInsertSchema } from 'drizzle-orm/zod';

// アプリの登録・編集フォームの入力です。アプリのテーブルの列から作り、入力の検証を足します。画面とサーバーの両方で検証します。
export const appSchema = createInsertSchema(app, {
  appId: (schema) => schema.min(1, 'アプリ ID を入力してください。'),
  name: (schema) => schema.min(1, '名称を入力してください。'),
  urlDomain: (schema) => schema.refine((value) => URL.canParse(value), 'URL の形式で入力してください。'),
})
  .pick({ appId: true, name: true, description: true, urlDomain: true, iconName: true })
  .required();

// ページの登録・編集フォームの入力です。ページのテーブルの列から作り、入力の検証を足します。画面とサーバーの両方で検証します。
// 必要なロールが未設定なら全員が見られます。
export const pageSchema = createInsertSchema(page, {
  pageId: (schema) => schema.min(1, 'ページ ID を入力してください。'),
  name: (schema) => schema.min(1, '名称を入力してください。'),
  relativePath: (schema) => schema.refine((value) => value === '' || value.startsWith('/'), '相対パスは / で始めてください。'),
})
  .pick({ appId: true, pageId: true, name: true, description: true, relativePath: true, role: true })
  .required();

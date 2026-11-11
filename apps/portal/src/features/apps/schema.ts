import { z } from 'zod';

// アプリの登録・編集フォームの入力です。画面とサーバーの両方で検証します。
export const appSchema = z.object({
  appId: z.string().min(1, 'アプリ ID を入力してください。'),
  name: z.string().min(1, '名称を入力してください。'),
  description: z.string(),
  urlDomain: z.url('URL の形式で入力してください。'),
  iconName: z.string(),
});

// ページの登録・編集フォームの入力です。画面とサーバーの両方で検証します。必要なロールの all は全員を表します。
export const pageSchema = z.object({
  appId: z.string(),
  pageId: z.string().min(1, 'ページ ID を入力してください。'),
  name: z.string().min(1, '名称を入力してください。'),
  description: z.string(),
  relativePath: z.string().refine((value) => value === '' || value.startsWith('/'), '相対パスは / で始めてください。'),
  role: z.enum(['all', 'viewer', 'editor', 'manager']),
});

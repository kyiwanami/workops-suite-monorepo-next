import { z } from 'zod';

// 部署の登録・編集フォームの入力です。画面とサーバーの両方で検証します。
export const departmentSchema = z.object({
  id: z.string(),
  code: z.string().min(1, '部署コードを入力してください。'),
  name: z.string().min(1, '部署名を入力してください。'),
  sortOrder: z.string().regex(/^-?\d+$/, '表示順は整数で入力してください。'),
  notes: z.string(),
});

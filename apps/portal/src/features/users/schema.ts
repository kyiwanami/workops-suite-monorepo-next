import { z } from 'zod';

// ユーザーの作成フォームの入力です。画面とサーバーの両方で検証します。
export const userSchema = z.object({
  name: z.string().min(1, '名前を入力してください。'),
  email: z.email('メールの形式で入力してください。'),
  departmentId: z.string().min(1, '部署を選んでください。'),
  role: z.string().min(1, 'ロールを選んでください。'),
});

// 所属の保存フォームの入力です。画面とサーバーの両方で検証します。
export const membershipSchema = z.object({
  sub: z.string(),
  departmentId: z.string().min(1, '部署を選んでください。'),
  role: z.string().min(1, 'ロールを選んでください。'),
  isAdmin: z.boolean(),
});

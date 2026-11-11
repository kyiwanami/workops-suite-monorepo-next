import { userMembership } from '@workops/blocks/schema';
import { createInsertSchema } from 'drizzle-orm/zod';
import { z } from 'zod';

// アカウントの状態です。招待中は、招待メールを送ったがまだ一度もログインしていない状態です。
export const accountStatus = z.enum(['invited', 'active', 'disabled']);

// 所属のテーブルの列から作る所属の入力です。部署は未選択の空から選ぶため、選んだかどうかで検証します。
const membershipColumns = createInsertSchema(userMembership)
  .pick({ sub: true, role: true, isAdmin: true })
  .required()
  .extend({ departmentId: z.string().min(1, '部署を選んでください。') });

// ユーザーの作成フォームの入力です。画面とサーバーの両方で検証します。
export const userSchema = membershipColumns.pick({ departmentId: true, role: true }).extend({
  name: z.string().min(1, '名前を入力してください。'),
  email: z.email('メールの形式で入力してください。'),
});

// 所属の保存フォームの入力です。画面とサーバーの両方で検証します。
export const membershipSchema = membershipColumns;

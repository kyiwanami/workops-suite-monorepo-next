import { z } from 'zod';

// 資産種別の登録・編集フォームの入力です。画面とサーバーの両方で検証します。
// 表示順は数の入力欄で、空のときも同じ文言を出します。説明は、AIツールの入力の説明にも使います。title は画面の項目名で、AIの確認カードに使います。
export const assetTypeSchema = z.object({
  code: z
    .string()
    .min(1, 'コードを入力してください。')
    .meta({ title: 'コード', description: '資産種別のコード。重複できない' }),
  name: z
    .string()
    .min(1, '種別名を入力してください。')
    .meta({ title: '種別名', description: '資産種別の名前' }),
  description: z
    .string()
    .nullable()
    .meta({ title: '説明', description: '資産種別の説明' }),
  sortOrder: z
    .number({ error: '表示順は整数で入力してください。' })
    .int('表示順は整数で入力してください。')
    .meta({ title: '表示順', description: '表示順' }),
});

// 登録した資産種別です。資産種別の登録の結果に使います。
export const assetTypeIdSchema = z.object({
  assetTypeId: z.uuid().meta({ description: '資産種別のID' }),
});

import { z } from 'zod';

// 資産の状態です。在庫・貸出中・修理中・廃棄済みです。
export const assetStatus = z.enum(['inStock', 'lent', 'inRepair', 'disposed']).describe('資産の状態');

// 資産の登録・編集の入力です。画面とサーバーの両方で検証します。
// 部署と種別は未選択の空から選ぶため、選んだかどうかで検証します。担当者が未設定なら未割当です。
export const assetSchema = z.object({
  name: z.string().min(1, '名称を入力してください。').describe('資産の名称'),
  status: assetStatus,
  assigneeSub: z.string().nullable().describe('担当者の利用者識別子。未割当なら null'),
  departmentId: z.string().min(1, '部署を選んでください。').describe('部署のID。全体管理者以外は自部署に登録される'),
  assetTypeId: z.string().min(1, '種別を選んでください。').describe('資産種別のID'),
});

// 資産の一覧の検索条件です。画面ではURLのクエリ文字列から作ります。
export const assetConditionsSchema = z.object({
  q: z.string().nullable().describe('資産の名称、または担当者の名前・メールの部分一致'),
  status: assetStatus.nullable(),
  type: z.string().nullable().describe('資産種別のID'),
  department: z.string().nullable().describe('部署のID。全体管理者だけに効く'),
  page: z.number().int().min(1).describe('ページ番号（1から）'),
});

// 資産の一覧の検索条件の型です。
export type AssetConditions = z.infer<typeof assetConditionsSchema>;

// 資産の一覧です。条件に合う件数と、このページの資産を返します。
export const assetListSchema = z.object({
  total: z.number().int().describe('条件に合う件数'),
  start: z.number().int().describe('このページの先頭の位置（0から）'),
  assets: z.array(
    z.object({
      id: z.string().describe('資産のID'),
      name: z.string().describe('資産の名称'),
      status: assetStatus,
      assigneeSub: z.string().nullable().describe('担当者の利用者識別子。未割当なら null'),
      assigneeName: z.string().nullable().describe('担当者の名前。未割当なら null'),
      assetTypeName: z.string().describe('資産種別の名前'),
      departmentName: z.string().describe('部署の名前'),
      updatedAt: z.string().describe('更新日時'),
    }),
  ),
});

// 資産の詳細です。
export const assetDetailSchema = z.object({
  id: z.string().describe('資産のID'),
  name: z.string().describe('資産の名称'),
  status: assetStatus,
  departmentId: z.string().describe('部署のID'),
  assetTypeId: z.string().describe('資産種別のID'),
  assetTypeName: z.string().describe('資産種別の名前'),
  assigneeSub: z.string().nullable().describe('担当者の利用者識別子。未割当なら null'),
  assigneeName: z.string().nullable().describe('担当者の名前。未割当なら null'),
  updatedAt: z.string().describe('更新日時'),
});

// 資産の登録・編集で選べる資産種別です。
export const assetTypeOptionSchema = z.object({
  id: z.string().describe('資産種別のID'),
  name: z.string().describe('資産種別の名前'),
});

// 操作する資産の指定です。詳細・削除の入力と、登録・編集・削除の結果に使います。
export const assetIdSchema = z.object({ assetId: z.uuid().describe('資産のID') });

// 資産の編集の入力です。対象の資産と、変更後の内容です。
export const assetUpdateSchema = assetSchema.extend(assetIdSchema.shape);

// 資産の登録・編集で選べる資産種別の一覧です。
export const assetTypeOptionsSchema = z.object({ assetTypes: z.array(assetTypeOptionSchema) });

// 資産の一覧・詳細・資産種別の選択肢の型です。
export type AssetList = z.infer<typeof assetListSchema>;
export type AssetDetail = z.infer<typeof assetDetailSchema>;
export type AssetTypeOption = z.infer<typeof assetTypeOptionSchema>;

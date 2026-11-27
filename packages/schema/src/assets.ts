import { z } from 'zod';

// 資産の状態です。在庫・貸出中・修理中・廃棄済みです。
export const assetStatus = z
  .enum(['inStock', 'lent', 'inRepair', 'disposed'])
  .meta({ title: '状態', description: '資産の状態' });

// 資産の登録・編集の入力です。画面とサーバーの両方で検証します。title は画面の項目名で、AIの確認カードに使います。
// 部署と種別は未選択の空から選ぶため、選んだかどうかで検証します。担当者が未設定なら未割当です。
export const assetSchema = z.object({
  name: z
    .string()
    .min(1, '名称を入力してください。')
    .meta({ title: '名称', description: '資産の名称' }),
  status: assetStatus,
  assigneeSub: z
    .string()
    .nullable()
    .meta({ title: '担当者', description: '担当者の利用者識別子。未割当なら null' }),
  departmentId: z
    .uuid('部署を選んでください。')
    .meta({ title: '部署', description: '部署のID。全体管理者以外は自部署に登録される' }),
  assetTypeId: z
    .uuid('種別を選んでください。')
    .meta({ title: '種別', description: '資産種別のID' }),
});

// 資産の一覧の検索条件です。画面ではURLのクエリ文字列から作ります。
export const assetConditionsSchema = z.object({
  q: z
    .string()
    .nullable()
    .meta({ description: '資産の名称、または担当者の名前・メールの部分一致' }),
  status: assetStatus.nullable(),
  type: z
    .uuid()
    .nullable()
    .meta({ description: '資産種別のID' }),
  department: z
    .uuid()
    .nullable()
    .meta({ description: '部署のID。全体管理者だけに効く' }),
  page: z
    .number()
    .int()
    .min(1)
    .meta({ description: 'ページ番号（1から）' }),
});

// 資産の一覧の検索条件の型です。
export type AssetConditions = z.infer<typeof assetConditionsSchema>;

// 資産の一覧の1件です。
export const assetItemSchema = z.object({
  id: z.string().meta({ description: '資産のID' }),
  name: z.string().meta({ description: '資産の名称' }),
  status: assetStatus,
  assigneeSub: z
    .string()
    .nullable()
    .meta({ description: '担当者の利用者識別子。未割当なら null' }),
  assigneeName: z
    .string()
    .nullable()
    .meta({ description: '担当者の名前。未割当なら null' }),
  assetTypeName: z.string().meta({ description: '資産種別の名前' }),
  departmentName: z.string().meta({ description: '部署の名前' }),
  updatedAt: z.string().meta({ description: '更新日時' }),
});

// 資産の一覧です。条件に合う件数と、このページの資産を返します。
export const assetListSchema = z.object({
  total: z
    .number()
    .int()
    .meta({ description: '条件に合う件数' }),
  start: z
    .number()
    .int()
    .meta({ description: 'このページの先頭の位置（0から）' }),
  assets: z.array(assetItemSchema),
});

// 資産の詳細です。
export const assetDetailSchema = z.object({
  id: z.string().meta({ description: '資産のID' }),
  name: z.string().meta({ description: '資産の名称' }),
  status: assetStatus,
  departmentId: z.string().meta({ description: '部署のID' }),
  departmentName: z.string().meta({ description: '部署の名前' }),
  assetTypeId: z.string().meta({ description: '資産種別のID' }),
  assetTypeName: z.string().meta({ description: '資産種別の名前' }),
  assigneeSub: z
    .string()
    .nullable()
    .meta({ description: '担当者の利用者識別子。未割当なら null' }),
  assigneeName: z
    .string()
    .nullable()
    .meta({ description: '担当者の名前。未割当なら null' }),
  updatedAt: z.string().meta({ description: '更新日時' }),
});

// 資産の登録・編集で選べる資産種別です。
export const assetTypeOptionSchema = z.object({
  id: z.string().meta({ description: '資産種別のID' }),
  name: z.string().meta({ description: '資産種別の名前' }),
});

// 操作する資産の指定です。詳細・削除の入力と、登録・編集・削除の結果に使います。
export const assetIdSchema = z.object({
  assetId: z.uuid().meta({ title: '資産', description: '資産のID' }),
});

// 資産の編集で変える内容です。渡した項目だけを変えます。部署は変えません。
export const assetChangesSchema = assetSchema.omit({ departmentId: true }).partial();

// 資産の編集の入力です。対象の資産と、変える項目だけです。
export const assetUpdateSchema = assetChangesSchema.extend(assetIdSchema.shape);

// 資産の登録・編集で選べる資産種別の一覧です。
export const assetTypeOptionsSchema = z.object({ assetTypes: z.array(assetTypeOptionSchema) });

// 部署の選択肢の1件です。
export const departmentOptionSchema = z.object({
  id: z.string().meta({ description: '部署のID' }),
  name: z.string().meta({ description: '部署名' }),
});

// 資産の登録で選べる部署の一覧です。全体管理者はすべての部署、それ以外は自部署だけです。
export const departmentOptionsSchema = z.object({ departments: z.array(departmentOptionSchema) });

// 担当者の候補の1人です。
export const memberSchema = z.object({
  sub: z.string().meta({ description: '利用者識別子。資産の担当者に指定する値' }),
  name: z.string().meta({ description: '利用者の名前' }),
  email: z.string().meta({ description: '利用者のメール' }),
  departmentId: z.string().meta({ description: '所属する部署のID' }),
});

// 資産の担当者に選べる、部署の有効な利用者の一覧です。全体管理者はすべての部署、それ以外は自部署の利用者です。
export const membersSchema = z.object({ members: z.array(memberSchema) });

// 担当者の候補の検索条件です。
export const memberConditionsSchema = z.object({
  q: z
    .string()
    .nullable()
    .meta({ description: '利用者の名前・メールの部分一致。すべての候補なら null' }),
});

// 資産の一覧・詳細・選択肢・状態・担当者の候補の型です。
export type AssetList = z.infer<typeof assetListSchema>;
export type AssetDetail = z.infer<typeof assetDetailSchema>;
export type AssetChanges = z.infer<typeof assetChangesSchema>;
export type AssetTypeOption = z.infer<typeof assetTypeOptionSchema>;
export type AssetItem = z.infer<typeof assetItemSchema>;
export type AssetStatus = z.infer<typeof assetStatus>;
export type DepartmentOption = z.infer<typeof departmentOptionSchema>;
export type Member = z.infer<typeof memberSchema>;

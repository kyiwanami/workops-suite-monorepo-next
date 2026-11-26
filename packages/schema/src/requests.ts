import { z } from 'zod';

// 申請の作成・編集の入力です。画面とサーバーの両方で検証します。
// 種別は未選択の空から選ぶため、選んだかどうかで検証します。金額は任意の整数で、未入力は null です。
export const requestSchema = z.object({
  title: z.string().min(1, '件名を入力してください。').describe('申請の件名'),
  description: z.string().nullable().describe('申請の説明'),
  requestTypeId: z.string().min(1, '申請種別を選んでください。').describe('申請種別のID。有効な種別だけを選べる'),
  amount: z
    .number({ error: '金額は整数で入力してください。' })
    .int('金額は整数で入力してください。')
    .nullable()
    .describe('金額（円）。なければ null'),
});

// 却下・差戻しの理由の入力です。
export const reasonSchema = z.object({
  reason: z.string().min(1, '理由を入力してください。').describe('却下・差戻しの理由'),
});

// 申請の一覧のタブです。すべて・自分が承認するもの・自分の申請です。
export const requestTabs = ['all', 'approve', 'mine'] as const;

// 申請の一覧の期間です。作成日時が今月・先月のもの、またはすべてです。
export const requestPeriods = ['thisMonth', 'lastMonth', 'all'] as const;

// 申請の一覧の検索条件です。画面ではURLのクエリ文字列から作ります。
export const requestConditionsSchema = z.object({
  tab: z.enum(requestTabs).describe('all：すべて、approve：自分が承認するもの（承認者以上）、mine：自分の申請'),
  q: z.string().nullable().describe('件名、または申請者の名前・メールの部分一致'),
  type: z.string().nullable().describe('申請種別のID'),
  period: z.enum(requestPeriods).describe('作成日時の期間。thisMonth：今月、lastMonth：先月、all：すべて'),
  department: z.string().nullable().describe('部署のID。全体管理者だけに効く'),
  page: z.number().int().min(1).describe('ページ番号（1から）'),
});

// 申請の一覧の検索条件の型です。
export type RequestConditions = z.infer<typeof requestConditionsSchema>;

// 申請の状態です。
export const requestStatus = z
  .enum(['draft', 'submitted', 'approved', 'rejected', 'withdrawn'])
  .describe('申請の状態。draft：下書き、submitted：提出済み、approved：承認済み、rejected：却下済み、withdrawn：取下げ済み');

// 申請の一覧です。タブごとの件数と、このページの申請を返します。
export const requestListSchema = z.object({
  tab: z.enum(requestTabs).describe('表示したタブ。承認者でなければ approve は all になる'),
  canApprove: z.boolean().describe('自分が承認するもののタブを使えるか'),
  counts: z
    .object({ all: z.number().int(), approve: z.number().int(), mine: z.number().int() })
    .describe('タブごとの件数'),
  total: z.number().int().describe('表示したタブの件数'),
  start: z.number().int().describe('このページの先頭の位置（0から）'),
  requests: z.array(
    z.object({
      id: z.string().describe('申請のID'),
      title: z.string().describe('申請の件名'),
      status: requestStatus,
      amount: z.number().int().nullable().describe('金額（円）'),
      requesterSub: z.string().describe('申請者の利用者識別子'),
      requesterName: z.string().nullable().describe('申請者の名前'),
      requestTypeName: z.string().describe('申請種別の名前'),
      departmentName: z.string().describe('部署の名前'),
      submittedAt: z.string().nullable().describe('提出日時。未提出なら null'),
    }),
  ),
});

// 申請の詳細です。
export const requestDetailSchema = z.object({
  id: z.string().describe('申請のID'),
  title: z.string().describe('申請の件名'),
  description: z.string().nullable().describe('申請の説明'),
  amount: z.number().int().nullable().describe('金額（円）'),
  status: requestStatus,
  requestTypeId: z.string().describe('申請種別のID'),
  requestTypeName: z.string().describe('申請種別の名前'),
  departmentName: z.string().describe('部署の名前'),
  requesterSub: z.string().describe('申請者の利用者識別子'),
  requesterName: z.string().nullable().describe('申請者の名前'),
  createdAt: z.string().describe('作成日時'),
  submittedAt: z.string().nullable().describe('提出日時'),
  approvedAt: z.string().nullable().describe('承認日時'),
  rejectedAt: z.string().nullable().describe('却下日時'),
  rejectionReason: z.string().nullable().describe('却下の理由'),
  withdrawnAt: z.string().nullable().describe('取下げ日時'),
  returnedAt: z.string().nullable().describe('差戻し日時'),
  returnReason: z.string().nullable().describe('差戻しの理由'),
});

// 利用者がその申請に対してできる操作です。
export const requestOperationsSchema = z.object({
  update: z.boolean().describe('編集できるか'),
  submit: z.boolean().describe('提出できるか'),
  withdraw: z.boolean().describe('取り下げられるか'),
  delete: z.boolean().describe('削除できるか'),
  approve: z.boolean().describe('承認できるか'),
  reject: z.boolean().describe('却下できるか'),
  return: z.boolean().describe('差し戻せるか'),
});

// 申請の作成・編集で選べる申請種別です。
export const requestTypeOptionSchema = z.object({
  id: z.string().describe('申請種別のID'),
  name: z.string().describe('申請種別の名前'),
});

// 操作する申請の指定です。詳細・提出・取下げ・承認の入力と、作成・編集・状態の変更の結果に使います。
export const requestIdSchema = z.object({ requestId: z.uuid().describe('申請のID') });

// 申請の編集の入力です。対象の申請と、変更後の内容です。
export const requestUpdateSchema = requestSchema.extend(requestIdSchema.shape);

// 申請の却下・差戻しの入力です。対象の申請と、理由です。
export const requestReasonSchema = reasonSchema.extend(requestIdSchema.shape);

// 申請の詳細と、利用者がその申請に対してできる操作です。
export const requestWithOperationsSchema = requestDetailSchema.extend({ operations: requestOperationsSchema });

// 申請の作成・編集で選べる申請種別の一覧です。
export const requestTypeOptionsSchema = z.object({ requestTypes: z.array(requestTypeOptionSchema) });

// 申請の一覧・詳細・できる操作・申請種別の選択肢の型です。
export type RequestList = z.infer<typeof requestListSchema>;
export type RequestDetail = z.infer<typeof requestDetailSchema>;
export type RequestOperations = z.infer<typeof requestOperationsSchema>;
export type RequestTypeOption = z.infer<typeof requestTypeOptionSchema>;

import { z } from 'zod';
import { assetTypeSchema } from './asset-types';
import {
  assetDetailSchema,
  assetIdSchema,
  assetSchema,
  assetUpdateSchema,
} from './assets';
import {
  requestIdSchema,
  requestReasonSchema,
  requestSchema,
  requestStatus,
  requestTransitions,
  requestUpdateSchema,
  requestWithOperationsSchema,
} from './requests';

// 確認カードの対象です。書込みのツールの入力から対象の ID（input）を取り出し、対象の今の値を、関連する名前と一緒に（value）カードに添えます。
const assetTarget = { input: assetIdSchema, value: assetDetailSchema };
const requestTarget = { input: requestIdSchema, value: requestWithOperationsSchema };

// 入力の項目の、画面の項目名です。編集の入力は項目を省略可能に包むため、包んだ中の項目名を使います。
export const fieldTitle = (field: z.ZodType) => z.globalRegistry.get(field instanceof z.ZodOptional ? field.unwrap() : field)?.title;

// 書込みのツールの、AIの確認カードの内容です。言葉と色は、デザインシステムの「確定ボタンの規則」に従います。
type WriteTool = {
  // ツールの入力。各項目の title を項目名に使います
  input: z.ZodObject<Record<string, z.ZodType<z.core.util.JSONType | undefined>>>;
  // 何をするかを「〜します」で書いた見出し
  heading: string;
  // 確定ボタンの操作の動詞
  action: string;
  // 確定ボタンを破壊的な操作の色にするか（却下・削除）
  destructive: boolean;
  // 操作の結果（元に戻せるか、相手が何をできるか）を伝える1文。なければ null
  note: string | null;
  // 確認カードの対象。対象のない新規作成では null
  target: typeof assetTarget | typeof requestTarget | null;
  // 操作のあとの申請の状態。状態を変えない操作では null
  nextStatus: z.infer<typeof requestStatus> | null;
};

// 書込みのツールの入力と確認カードの内容です。MCP サーバーはツールの入力に、BFF と画面は確認カードに使います。
export const writeToolCards = {
  'create-asset': {
    input: assetSchema,
    heading: '資産を登録します',
    action: '登録する',
    destructive: false,
    note: null,
    target: null,
    nextStatus: null,
  },
  'update-asset': {
    input: assetUpdateSchema,
    heading: '資産を更新します',
    action: '更新する',
    destructive: false,
    note: null,
    target: assetTarget,
    nextStatus: null,
  },
  'delete-asset': {
    input: assetIdSchema,
    heading: '資産を削除します',
    action: '削除する',
    destructive: true,
    note: '削除した資産は元に戻せません。',
    target: assetTarget,
    nextStatus: null,
  },
  'create-asset-type': {
    input: assetTypeSchema,
    heading: '資産種別を登録します',
    action: '登録する',
    destructive: false,
    note: null,
    target: null,
    nextStatus: null,
  },
  'create-request': {
    input: requestSchema,
    heading: '申請を作成します',
    action: '作成する',
    destructive: false,
    note: null,
    target: null,
    nextStatus: null,
  },
  'update-request': {
    input: requestUpdateSchema,
    heading: '申請を更新します',
    action: '更新する',
    destructive: false,
    note: null,
    target: requestTarget,
    nextStatus: null,
  },
  'submit-request': {
    input: requestIdSchema,
    heading: '申請を提出します',
    action: '提出する',
    destructive: false,
    note: null,
    target: requestTarget,
    nextStatus: requestTransitions.submit,
  },
  'withdraw-request': {
    input: requestIdSchema,
    heading: '申請を取り下げます',
    action: '取り下げる',
    destructive: false,
    note: '取り下げた申請は元に戻せません。',
    target: requestTarget,
    nextStatus: requestTransitions.withdraw,
  },
  'approve-request': {
    input: requestIdSchema,
    heading: '申請を承認します',
    action: '承認する',
    destructive: false,
    note: '承認した申請は元に戻せません。',
    target: requestTarget,
    nextStatus: requestTransitions.approve,
  },
  'reject-request': {
    input: requestReasonSchema,
    heading: '申請を却下します',
    action: '却下する',
    destructive: true,
    note: '却下した申請は元に戻せず、申請者は再提出できません。',
    target: requestTarget,
    nextStatus: requestTransitions.reject,
  },
  'return-request': {
    input: requestReasonSchema,
    heading: '申請を差し戻します',
    action: '差し戻す',
    destructive: false,
    note: '申請は下書きに戻り、申請者が修正して再提出できます。',
    target: requestTarget,
    nextStatus: requestTransitions.return,
  },
} satisfies Record<string, WriteTool>;

// 書込みのツールの確認カードの内容を、ツール名から引きます。
export const writeTools = new Map<string, WriteTool>(Object.entries(writeToolCards));

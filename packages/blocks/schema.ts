import { sql } from 'drizzle-orm';
import { boolean, check, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// テーブル定義をSQL生成と読み書きの型推論の共通の定義元にします。
// 日時はData APIの戻り値に合わせて文字列で扱います。
const commonColumns = {
  createdAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(), // 作成日時
  createdBy: text().notNull(), // 作成者の利用者識別子
  updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(), // 更新日時
  updatedBy: text().notNull(), // 更新者の利用者識別子
};

// 部署
export const department = pgTable('Department', {
  id: uuid().primaryKey().defaultRandom(), // 部署ID
  code: text().notNull(), // 部署コード
  name: text().notNull(), // 部署名
  sortOrder: integer().notNull(), // 表示順
  notes: text(), // 備考
  ...commonColumns,
});

// 利用者。Cognito の利用者を、利用者の同期の Lambda が反映します。作成者・更新者には同期の印を入れます。
export const user = pgTable('User', {
  sub: text().primaryKey(), // 利用者識別子（Cognito sub）
  name: text(), // 名前。自分で登録した利用者は未設定のことがある
  email: text().notNull(), // メール
  enabled: boolean().notNull(), // Cognito で有効か
  ...commonColumns,
});

// ユーザー所属
export const userMembership = pgTable('UserMembership', {
  sub: text().primaryKey(), // 利用者識別子（Cognito sub）
  departmentId: uuid().notNull().references(() => department.id, { onDelete: 'restrict' }), // 所属部署ID
  role: text({ enum: ['viewer', 'editor', 'manager'] }).notNull(), // 業務ロール
  isAdmin: boolean().notNull().default(false), // 全体管理者区分
  ...commonColumns,
}, () => [check('UserMembership_role', sql`"role" in ('viewer', 'editor', 'manager')`)]);

// アプリ
export const app = pgTable('App', {
  appId: text().primaryKey(), // アプリ識別子
  name: text().notNull(), // 名称
  description: text(), // 説明
  urlDomain: text().notNull(), // URL
  iconName: text(), // アイコン
  color: text(), // 色
  ...commonColumns,
});

// ページ
export const page = pgTable('Page', {
  appId: text().notNull().references(() => app.appId, { onDelete: 'cascade' }), // 親アプリ識別子
  pageId: text().notNull(), // ページ識別子
  name: text().notNull(), // 名称
  description: text(), // 説明
  relativePath: text(), // 相対パス
  iconName: text(), // アイコン
  role: text({ enum: ['viewer', 'editor', 'manager'] }), // 閲覧に必要な最小のロール（未設定は全員）
  ...commonColumns,
}, table => [
  primaryKey({ name: 'Page_pkey', columns: [table.appId, table.pageId] }),
  check('Page_role', sql`"role" in ('viewer', 'editor', 'manager')`),
]);

// 資産種別
export const assetType = pgTable('AssetType', {
  id: uuid().primaryKey().defaultRandom(), // 資産種別ID
  code: text().notNull().unique(), // 種別コード
  name: text().notNull(), // 種別名
  description: text(), // 説明
  sortOrder: integer().notNull(), // 表示順
  ...commonColumns,
});

// 資産
export const asset = pgTable('Asset', {
  id: uuid().primaryKey().defaultRandom(), // 資産ID
  departmentId: uuid().notNull().references(() => department.id, { onDelete: 'restrict' }), // 所属部署ID
  name: text().notNull(), // 資産名
  assetTypeId: uuid().notNull().references(() => assetType.id, { onDelete: 'restrict' }), // 資産種別ID
  status: text({ enum: ['inStock', 'lent', 'inRepair', 'disposed'] }).notNull(), // 資産の状態
  assigneeSub: text(), // 担当者の利用者識別子
  ...commonColumns,
}, () => [check('Asset_status', sql`"status" in ('inStock', 'lent', 'inRepair', 'disposed')`)]);

// 申請種別
export const requestType = pgTable('RequestType', {
  id: uuid().primaryKey().defaultRandom(), // 申請種別ID
  code: text().notNull(), // 種別コード
  name: text().notNull(), // 種別名
  description: text(), // 説明
  isActive: boolean().notNull().default(true), // 有効区分
  sortOrder: integer().notNull(), // 表示順
  ...commonColumns,
});

// 申請
export const request = pgTable('Request', {
  id: uuid().primaryKey().defaultRandom(), // 申請ID
  departmentId: uuid().notNull().references(() => department.id, { onDelete: 'restrict' }), // 所属部署ID
  requestTypeId: uuid().notNull().references(() => requestType.id, { onDelete: 'restrict' }), // 申請種別ID
  requesterSub: text().notNull(), // 申請者の利用者識別子
  title: text().notNull(), // 件名
  description: text(), // 説明
  amount: integer(), // 金額
  status: text({ enum: ['draft', 'submitted', 'approved', 'rejected', 'withdrawn'] }).notNull(), // 申請の状態
  submittedAt: timestamp({ withTimezone: true, mode: 'string' }), // 提出日時
  approvedAt: timestamp({ withTimezone: true, mode: 'string' }), // 承認日時
  approverSub: text(), // 承認者の利用者識別子
  rejectedAt: timestamp({ withTimezone: true, mode: 'string' }), // 却下日時
  rejectionReason: text(), // 却下理由
  withdrawnAt: timestamp({ withTimezone: true, mode: 'string' }), // 取下げ日時
  returnedAt: timestamp({ withTimezone: true, mode: 'string' }), // 差戻し日時
  returnReason: text(), // 差戻し理由
  ...commonColumns,
}, () => [check('Request_status', sql`"status" in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn')`)]);

// 監査ログ
// 操作ごとに追記し、createdAt・createdByに操作日時・操作者を記録します。
// 申請を削除しても監査履歴のrequestIdを保持するため、外部キーは設定しません。
export const auditLog = pgTable('AuditLog', {
  id: uuid().primaryKey().defaultRandom(), // 監査ログID
  requestId: uuid().notNull(), // 対象申請ID
  action: text({ enum: ['create', 'update', 'submit', 'withdraw', 'approve', 'reject', 'return', 'delete'] }).notNull(), // 操作
  previousStatus: text({ enum: ['draft', 'submitted', 'approved', 'rejected', 'withdrawn'] }), // 操作前の状態
  newStatus: text({ enum: ['draft', 'submitted', 'approved', 'rejected', 'withdrawn'] }), // 操作後の状態
  reason: text(), // 理由
  createdAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(), // 操作日時
  createdBy: text().notNull(), // 操作者の利用者識別子
}, () => [
  check('AuditLog_action', sql`"action" in ('create', 'update', 'submit', 'withdraw', 'approve', 'reject', 'return', 'delete')`),
  check('AuditLog_previousStatus', sql`"previousStatus" in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn')`),
  check('AuditLog_newStatus', sql`"newStatus" in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn')`),
]);

// 確認カードの判断
// AIチャットの書込みツールの呼び出し（確認カード）ごとに、表示から判断・実行結果までの状態を記録します。
// 判断は状態が requested の行だけを更新して受け付け、同じ呼び出しへの判断を最初の1回だけ受け付けます。
// createdAt・createdByに確認カードを表示した日時と依頼した利用者、updatedAt・updatedByに最後に状態を更新した日時と利用者を記録します。
// target には、確認カードの「変更前」と、履歴で同じ確認カードを出すために、表示した時点の対象の値を残します。
export const toolApproval = pgTable('ToolApproval', {
  toolUseId: text().primaryKey(), // ツール呼び出しのID
  conversationId: uuid().notNull(), // 会話のID
  toolName: text().notNull(), // ツール名
  input: jsonb().notNull(), // ツール呼び出しの入力
  status: text({ enum: ['requested', 'approved', 'denied', 'succeeded', 'failed', 'abandoned', 'expired'] }).notNull(), // 状態
  target: jsonb(), // 確認カードを表示した時点の対象の値（読み取りツールの結果）。対象のない新規作成のツールでは空
  names: jsonb(), // 確認カードの入力の ID の項目の名前（読み取りツールで引いた値）。ID の項目がないツールでは空
  ...commonColumns,
}, () => [check('ToolApproval_status', sql`"status" in ('requested', 'approved', 'denied', 'succeeded', 'failed', 'abandoned', 'expired')`)]);

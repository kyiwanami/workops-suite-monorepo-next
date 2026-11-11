// ページを見るのに必要なロールの選択肢と表示名です。all は全員が見られることを表します。
export const pageRoles = [
  { value: 'all', label: '全員' },
  { value: 'viewer', label: '閲覧者以上' },
  { value: 'editor', label: '担当者以上' },
  { value: 'manager', label: '承認者以上' },
];

// ページの必要なロールの値から表示名を引きます。未設定は「全員」です。
export const pageRoleLabel = (role: string | null) => pageRoles.find((item) => item.value === (role ?? 'all'))?.label;

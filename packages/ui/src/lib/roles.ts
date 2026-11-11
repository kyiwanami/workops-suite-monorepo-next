// 業務ロールの表示名と、それぞれでできることです。全アプリで同じ表示名を使います。
export const roles = [
  { value: 'viewer', label: '閲覧者', description: '自部署の資産・申請を見られます' },
  { value: 'editor', label: '担当者', description: '資産の登録・更新と、申請の作成・提出ができます' },
  {
    value: 'manager',
    label: '承認者',
    description: '担当者の操作に加え、資産の削除、申請の承認・却下・差戻し、種別の管理ができます',
  },
];

// ロールの値から表示名を引きます。
export const roleLabels: Record<string, string> = Object.fromEntries(roles.map((role) => [role.value, role.label]));

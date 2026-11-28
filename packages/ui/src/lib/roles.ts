import type { MemberRole } from '@workops/domain/membership';

// ロールの値ごとの表示名です。全アプリで同じ表示名を使います。
export const roleLabels: Record<MemberRole, string> = { viewer: '閲覧者', editor: '担当者', manager: '承認者' };

// 業務ロールの表示名と、それぞれでできることです。
export const roles: { value: MemberRole; label: string; description: string }[] = [
  { value: 'viewer', label: roleLabels.viewer, description: '自部署の資産・申請を見られます' },
  { value: 'editor', label: roleLabels.editor, description: '資産の登録・更新と、申請の作成・提出ができます' },
  {
    value: 'manager',
    label: roleLabels.manager,
    description: '担当者の操作に加え、資産の削除、申請の承認・却下・差戻し、種別の管理ができます',
  },
];

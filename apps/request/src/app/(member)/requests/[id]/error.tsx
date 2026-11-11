'use client';

import { useParams } from 'next/navigation';
import { OperationError } from '@/features/requests/components/OperationError';

// 申請の詳細で、確認を経た操作（取下げ・削除・承認）が失敗したときの画面です。保存済みの申請を確認するよう案内します。
export default function RequestError() {
  const params = useParams<{ id: string }>();
  return <OperationError title="操作できませんでした" description="保存済みの申請を確認してください。" requestId={params.id} />;
}

import { PageNotFound } from '@workops/ui/workops/page-not-found';

export default function NotFound() {
  return <PageNotFound title="この申請は表示できません" description="ほかの部署の申請か、すでに削除された申請です。申請一覧から探し直してください。" href="/requests" label="申請一覧へ" />;
}

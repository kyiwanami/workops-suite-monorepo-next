import { PageNotFound } from '@workops/ui/workops/page-not-found';

export default function NotFound() {
  return <PageNotFound title="このページは表示できません" description="権限がないか、すでに削除されたページです。" href="/assets" label="資産の一覧へ戻る" />;
}

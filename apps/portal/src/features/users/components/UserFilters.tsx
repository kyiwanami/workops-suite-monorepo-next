'use client';

import { Input } from '@workops/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workops/ui/components/select';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { statusBadges } from '../labels';

// 「すべて」を表す選択肢の値です。Select は空の値を選択肢にできないため、この値で表します。
const all = 'all';

// ユーザーの一覧の検索と絞り込みです。検索語は Enter で、部署と状態は選んだ時点で反映します。
// 条件は URL に持ち、条件を変えたら1ページ目に戻します。
export function UserFilters({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const apply = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === '' || value === all) {
      params.delete(name);
    } else {
      params.set(name, value);
    }
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`);
  };
  return (
    <div className="flex flex-wrap gap-3">
      <form
        className="min-w-60 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          apply('q', String(new FormData(event.currentTarget).get('q')));
        }}
      >
        <Input name="q" type="search" placeholder="名前・メールで検索" defaultValue={searchParams.get('q') ?? ''} />
      </form>
      <Select defaultValue={searchParams.get('department') ?? all} onValueChange={(value) => apply('department', value)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={all}>部署：すべて</SelectItem>
          {departments.map((department) => (
            <SelectItem key={department.id} value={department.id}>
              部署：{department.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select defaultValue={searchParams.get('status') ?? all} onValueChange={(value) => apply('status', value)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={all}>状態：すべて</SelectItem>
          {Object.entries(statusBadges).map(([value, badge]) => (
            <SelectItem key={value} value={value}>
              状態：{badge.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

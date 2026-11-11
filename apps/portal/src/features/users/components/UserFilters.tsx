'use client';

import { Input } from '@workops/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workops/ui/components/select';
import { useQueryStates } from 'nuqs';
import type { DepartmentOption } from '../data';
import { statusBadges } from '../labels';
import { accountStatus } from '../schema';
import { userSearchParams } from '../search-params';

// 「すべて」を表す選択肢の値です。Select は空の値を選択肢にできないため、この値で表します。
const all = 'all';

// ユーザーの一覧の検索と絞り込みです。検索語は Enter で、部署と状態は選んだ時点で反映します。
// 条件は URL に持ち、サーバーで一覧を読み直します。条件を変えたら1ページ目に戻します。
export function UserFilters({ departments }: { departments: DepartmentOption[] }) {
  const [params, setParams] = useQueryStates(userSearchParams, { shallow: false });
  return (
    <div className="flex flex-wrap gap-3">
      <form
        className="min-w-60 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          void setParams({ q: String(new FormData(event.currentTarget).get('q')) || null, page: null });
        }}
      >
        <Input name="q" type="search" placeholder="名前・メールで検索" defaultValue={params.q ?? ''} />
      </form>
      <Select
        value={params.department ?? all}
        onValueChange={(value) => void setParams({ department: value === all ? null : value, page: null })}
      >
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
      <Select
        value={params.status ?? all}
        onValueChange={(value) => void setParams({ status: value === all ? null : accountStatus.parse(value), page: null })}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={all}>状態：すべて</SelectItem>
          {accountStatus.options.map((value) => (
            <SelectItem key={value} value={value}>
              状態：{statusBadges[value].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

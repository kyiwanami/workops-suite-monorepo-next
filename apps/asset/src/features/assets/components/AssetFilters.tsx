'use client';

import { Input } from '@workops/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workops/ui/components/select';
import { useQueryStates } from 'nuqs';
import type { Option } from '../data';
import { statusBadges } from '../labels';
import { assetStatus } from '../schema';
import { assetSearchParams } from '../search-params';

// 「すべて」を表す選択肢の値です。Select は空の値を選択肢にできないため、この値で表します。
const all = 'all';

// 資産の一覧の検索と絞り込みです。検索語は Enter で、状態・種別・部署は選んだ時点で反映します。
// 部署の絞り込みは、部署の選択肢を渡したとき（全体管理者）だけ出します。
// 条件は URL に持ち、サーバーで一覧を読み直します。条件を変えたら1ページ目に戻し、保存した旨の表示を消します。
export function AssetFilters({ assetTypes, departments }: { assetTypes: Option[]; departments: Option[] | null }) {
  const [params, setParams] = useQueryStates(assetSearchParams, { shallow: false });
  return (
    <div className="flex flex-wrap gap-3">
      <form
        className="min-w-60 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          void setParams({ q: String(new FormData(event.currentTarget).get('q')) || null, page: null, saved: null });
        }}
      >
        <Input name="q" type="search" placeholder="名称・担当者で検索" defaultValue={params.q ?? ''} />
      </form>
      <Select
        value={params.status ?? all}
        onValueChange={(value) => void setParams({ status: value === all ? null : assetStatus.parse(value), page: null, saved: null })}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={all}>状態：すべて</SelectItem>
          {assetStatus.options.map((value) => (
            <SelectItem key={value} value={value}>
              状態：{statusBadges[value].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={params.type ?? all}
        onValueChange={(value) => void setParams({ type: value === all ? null : value, page: null, saved: null })}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={all}>種別：すべて</SelectItem>
          {assetTypes.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              種別：{item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {departments !== null && (
        <Select
          value={params.department ?? all}
          onValueChange={(value) => void setParams({ department: value === all ? null : value, page: null, saved: null })}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={all}>部署：すべて</SelectItem>
            {departments.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                部署：{item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

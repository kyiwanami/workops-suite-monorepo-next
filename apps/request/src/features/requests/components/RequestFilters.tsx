'use client';

import { Badge } from '@workops/ui/components/badge';
import { Input } from '@workops/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workops/ui/components/select';
import { Tabs, TabsList, TabsTrigger } from '@workops/ui/components/tabs';
import { useQueryStates } from 'nuqs';
import type { listRequests, Option } from '../data';
import { requestPeriods, requestSearchParams, requestTabs } from '../search-params';

// 「すべて」を表す選択肢の値です。Select は空の値を選択肢にできないため、この値で表します。
const all = 'all';

// 期間の表示名です。
const periodLabels: Record<(typeof requestPeriods)[number], string> = {
  thisMonth: '今月',
  lastMonth: '先月',
  all: 'すべて',
};

// 申請の一覧のタブと、検索・絞り込みです。タブは固定の絞り込みで、件数を添えます。「自分が承認するもの」は承認者以上だけに出します。
// 検索語は Enter で、種別・期間・部署は選んだ時点で反映します。部署の絞り込みは、部署の選択肢を渡したとき（全体管理者）だけ出します。
// 条件は URL に持ち、サーバーで一覧を読み直します。条件を変えたら1ページ目に戻し、保存した旨の表示を消します。
export function RequestFilters({
  canApprove,
  counts,
  requestTypes,
  departments,
}: {
  canApprove: boolean;
  counts: Awaited<ReturnType<typeof listRequests>>['counts'];
  requestTypes: Option[];
  departments: Option[] | null;
}) {
  const [params, setParams] = useQueryStates(requestSearchParams, { shallow: false });
  return (
    <>
      <Tabs
        value={params.tab}
        onValueChange={(value) => {
          const tab = requestTabs.find((item) => item === value);
          void setParams({ tab: tab ?? null, page: null, saved: null });
        }}
      >
        <TabsList>
          <TabsTrigger value="all">
            すべて
            <Badge variant="secondary" className="font-mono tabular-nums">
              {counts.all}
            </Badge>
          </TabsTrigger>
          {canApprove && (
            <TabsTrigger value="approve">
              <span className="hidden md:inline">自分が承認するもの</span>
              <span className="md:hidden">承認するもの</span>
              <Badge variant="info" className="font-mono tabular-nums">
                {counts.approve}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="mine">
            自分の申請
            <Badge variant="secondary" className="font-mono tabular-nums">
              {counts.mine}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-3">
        <form
          className="min-w-60 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            void setParams({ q: String(new FormData(event.currentTarget).get('q')) || null, page: null, saved: null });
          }}
        >
          <Input name="q" type="search" placeholder="件名・申請者で検索" defaultValue={params.q ?? ''} />
        </form>
        <Select
          value={params.type ?? all}
          onValueChange={(value) => void setParams({ type: value === all ? null : value, page: null, saved: null })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={all}>種別：すべて</SelectItem>
            {requestTypes.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                種別：{item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={params.period}
          onValueChange={(value) => {
            const period = requestPeriods.find((item) => item === value);
            void setParams({ period: period ?? null, page: null, saved: null });
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {requestPeriods.map((value) => (
              <SelectItem key={value} value={value}>
                期間：{periodLabels[value]}
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
    </>
  );
}

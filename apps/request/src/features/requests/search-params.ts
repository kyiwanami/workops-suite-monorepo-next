import {
  createLoader,
  createSerializer,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';
import { requestPeriod, requestTab } from '@workops/schema/requests';

// 申請の一覧の検索条件です。URL に持ち、画面とサーバーの両方で同じ形で読み書きします。
// done は、申請を保存・操作して一覧へ戻ったことと、その操作を表します。
export const requestSearchParams = {
  tab: parseAsStringLiteral(requestTab.options).withDefault('all'),
  q: parseAsString,
  type: parseAsString,
  period: parseAsStringLiteral(requestPeriod.options).withDefault('thisMonth'),
  department: parseAsString,
  page: parseAsInteger.withDefault(1),
  done: parseAsStringLiteral(['saved', 'submitted', 'withdrawn', 'deleted', 'approved', 'rejected', 'returned']),
};

// サーバーで URL から検索条件を読みます。
export const loadRequestSearchParams = createLoader(requestSearchParams);

// 検索条件から一覧の URL を作ります。
export const serializeRequestSearchParams = createSerializer(requestSearchParams);

// 申請の詳細の条件です。failed は、申請の今の状態で操作できず、詳細へ戻ったことを表します。
export const requestDetailSearchParams = { failed: parseAsBoolean };

// サーバーで URL から詳細の条件を読みます。
export const loadRequestDetailSearchParams = createLoader(requestDetailSearchParams);

// 詳細の条件から詳細の URL を作ります。
export const serializeRequestDetailSearchParams = createSerializer(requestDetailSearchParams);

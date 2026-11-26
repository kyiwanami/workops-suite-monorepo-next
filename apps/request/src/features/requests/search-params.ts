import {
  createLoader,
  createSerializer,
  type inferParserType,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';
import { requestPeriods, requestTabs } from '@workops/schema/requests';

// 申請の一覧の検索条件です。URL に持ち、画面とサーバーの両方で同じ形で読み書きします。
// saved は、申請を保存・操作して一覧へ戻ったことを表します。
export const requestSearchParams = {
  tab: parseAsStringLiteral(requestTabs).withDefault('all'),
  q: parseAsString,
  type: parseAsString,
  period: parseAsStringLiteral(requestPeriods).withDefault('thisMonth'),
  department: parseAsString,
  page: parseAsInteger.withDefault(1),
  saved: parseAsBoolean,
};

// サーバーで URL から検索条件を読みます。
export const loadRequestSearchParams = createLoader(requestSearchParams);

// 検索条件から一覧の URL を作ります。
export const serializeRequestSearchParams = createSerializer(requestSearchParams);

// 読んだ検索条件の型です。
export type RequestSearchParams = inferParserType<typeof requestSearchParams>;

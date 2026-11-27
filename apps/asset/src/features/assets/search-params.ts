import { assetStatus } from '@workops/schema/assets';
import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';

// 資産の一覧の検索条件です。URL に持ち、画面とサーバーの両方で同じ形で読み書きします。
// done は、資産を保存・削除して一覧へ戻ったことを表します。
export const assetSearchParams = {
  q: parseAsString,
  status: parseAsStringLiteral(assetStatus.options),
  type: parseAsString,
  department: parseAsString,
  page: parseAsInteger.withDefault(1),
  done: parseAsStringLiteral(['saved', 'deleted']),
};

// サーバーで URL から検索条件を読みます。
export const loadAssetSearchParams = createLoader(assetSearchParams);

// 検索条件から一覧の URL を作ります。
export const serializeAssetSearchParams = createSerializer(assetSearchParams);

import { asset } from '@workops/blocks/schema';
import {
  createLoader,
  createSerializer,
  type inferParserType,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';

// 資産の一覧の検索条件です。URL に持ち、画面とサーバーの両方で同じ形で読み書きします。
// saved は、資産を保存して一覧へ戻ったことを表します。
export const assetSearchParams = {
  q: parseAsString,
  status: parseAsStringLiteral(asset.status.enumValues),
  type: parseAsString,
  department: parseAsString,
  page: parseAsInteger.withDefault(1),
  saved: parseAsBoolean,
};

// サーバーで URL から検索条件を読みます。
export const loadAssetSearchParams = createLoader(assetSearchParams);

// 検索条件から一覧の URL を作ります。
export const serializeAssetSearchParams = createSerializer(assetSearchParams);

// 読んだ検索条件の型です。
export type AssetSearchParams = inferParserType<typeof assetSearchParams>;

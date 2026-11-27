import { createLoader, createSerializer, parseAsStringLiteral } from 'nuqs/server';

// 資産種別の一覧の条件です。done は、登録・保存・削除して一覧へ戻ったことと、その操作を表します。
export const assetTypeSearchParams = { done: parseAsStringLiteral(['created', 'saved', 'deleted']) };

// サーバーで URL から条件を読みます。
export const loadAssetTypeSearchParams = createLoader(assetTypeSearchParams);

// 条件から一覧の URL を作ります。
export const serializeAssetTypeSearchParams = createSerializer(assetTypeSearchParams);

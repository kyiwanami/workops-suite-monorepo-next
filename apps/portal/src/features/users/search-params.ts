import { createLoader, createSerializer, type inferParserType, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';
import { accountStatus } from './schema';

// ユーザーの一覧の検索条件です。URL に持ち、画面とサーバーの両方で同じ形で読み書きします。
export const userSearchParams = {
  q: parseAsString,
  department: parseAsString,
  status: parseAsStringLiteral(accountStatus.options),
  page: parseAsInteger.withDefault(1),
  // ユーザーを削除して一覧へ戻ったこと
  done: parseAsStringLiteral(['deleted']),
};

// サーバーで URL から検索条件を読みます。
export const loadUserSearchParams = createLoader(userSearchParams);

// 検索条件から一覧の URL を作ります。
export const serializeUserSearchParams = createSerializer(userSearchParams);

// ユーザーの詳細の条件です。done は、有効・無効にして詳細へ戻ったことと、その操作を表します。
export const userDetailSearchParams = { done: parseAsStringLiteral(['enabled', 'disabled']) };

// サーバーで URL から詳細の条件を読みます。
export const loadUserDetailSearchParams = createLoader(userDetailSearchParams);

// 詳細の条件から詳細の URL を作ります。
export const serializeUserDetailSearchParams = createSerializer(userDetailSearchParams);

// 読んだ検索条件の型です。
export type UserSearchParams = inferParserType<typeof userSearchParams>;

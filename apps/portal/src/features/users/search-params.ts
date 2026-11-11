import { createLoader, createSerializer, type inferParserType, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';
import { accountStatus } from './schema';

// ユーザーの一覧の検索条件です。URL に持ち、画面とサーバーの両方で同じ形で読み書きします。
export const userSearchParams = {
  q: parseAsString,
  department: parseAsString,
  status: parseAsStringLiteral(accountStatus.options),
  page: parseAsInteger.withDefault(1),
};

// サーバーで URL から検索条件を読みます。
export const loadUserSearchParams = createLoader(userSearchParams);

// 検索条件から一覧の URL を作ります。
export const serializeUserSearchParams = createSerializer(userSearchParams);

// 読んだ検索条件の型です。
export type UserSearchParams = inferParserType<typeof userSearchParams>;

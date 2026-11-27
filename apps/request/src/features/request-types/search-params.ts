import { createLoader, createSerializer, parseAsStringLiteral } from 'nuqs/server';

// 申請種別の一覧の条件です。done は、登録・保存・削除して一覧へ戻ったことと、その操作を表します。
export const requestTypeSearchParams = { done: parseAsStringLiteral(['created', 'saved', 'deleted']) };

// サーバーで URL から条件を読みます。
export const loadRequestTypeSearchParams = createLoader(requestTypeSearchParams);

// 条件から一覧の URL を作ります。
export const serializeRequestTypeSearchParams = createSerializer(requestTypeSearchParams);

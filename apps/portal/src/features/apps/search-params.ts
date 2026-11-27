import { createLoader, createSerializer, parseAsStringLiteral } from 'nuqs/server';

// アプリ・ページの一覧の条件です。done は、登録・保存・削除して一覧へ戻ったことと、その操作を表します。
export const appSearchParams = { done: parseAsStringLiteral(['appCreated', 'appSaved', 'appDeleted', 'pageCreated', 'pageSaved', 'pageDeleted']) };

// サーバーで URL から条件を読みます。
export const loadAppSearchParams = createLoader(appSearchParams);

// 条件から一覧の URL を作ります。
export const serializeAppSearchParams = createSerializer(appSearchParams);

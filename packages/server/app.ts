import 'server-only';
import { app } from '@workops/blocks/schema';
import { asc } from 'drizzle-orm';
import { cache } from 'react';
import { db } from './db';

// ヘッダーのアプリの切替に出すアプリの一覧です。登録した順に並べます。1回のリクエストの中では結果を使い回します。
export const getApps = cache(() =>
  db
    .select({ appId: app.appId, name: app.name, urlDomain: app.urlDomain })
    .from(app)
    .orderBy(asc(app.createdAt)),
);

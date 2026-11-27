import { app } from '@workops/blocks/schema';
import type { AwsDataApiPgDatabase } from 'drizzle-orm/aws-data-api/pg';

// 登録されたアプリのURLです。環境ごとのアプリのURLが入ります。
export async function listAppUrls(db: AwsDataApiPgDatabase) {
  const apps = await db.select({ urlDomain: app.urlDomain }).from(app);
  return apps.map((row) => row.urlDomain);
}

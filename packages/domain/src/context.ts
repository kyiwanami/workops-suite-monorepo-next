import type { AwsDataApiPgDatabase } from 'drizzle-orm/aws-data-api/pg';
import type { Membership } from './membership';

// 業務の処理に渡す、接続と操作する利用者です。接続は呼び出し元が1回作って渡します。
export type Context = {
  db: AwsDataApiPgDatabase;
  member: Membership;
};

import { Scope } from '@aws-blocks/blocks';
import { Database } from '@aws-blocks/bb-data';

// 共通の業務DBをData API経由で使用します。マイグレーションはdrizzle-kitで適用します。
// 最小容量0で自動停止を有効にし、停止までの時間はAurora標準の300秒を使用します。
export const db = new Database(new Scope('workops'), 'db', {
  databaseName: 'workops',
  postgresVersion: '17.11',
  minCapacity: 0,
  maxCapacity: 2,
});

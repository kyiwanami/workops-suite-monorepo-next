import 'server-only';
import { RDSDataClient } from '@aws-sdk/client-rds-data';
import outputs from '@workops/backend/outputs';
import { drizzle } from 'drizzle-orm/aws-data-api/pg';

// 共有のAuroraへData API経由で接続します。認証情報はAWS SDKの既定の取得順で得ます。
export const db = drizzle({
  client: new RDSDataClient({ region: outputs.auth.aws_region }),
  database: outputs.custom.database.databaseName,
  secretArn: outputs.custom.database.secretArn,
  resourceArn: outputs.custom.database.clusterArn,
});

import 'server-only';
import { createDatabase } from '@workops/domain/database';
import outputs from '@workops/backend/outputs';

// 共有のAuroraへData API経由で接続します。接続先はAmplifyの出力から読みます。
export const db = createDatabase({
  region: outputs.auth.aws_region,
  database: outputs.custom.database.databaseName,
  secretArn: outputs.custom.database.secretArn,
  resourceArn: outputs.custom.database.clusterArn,
});

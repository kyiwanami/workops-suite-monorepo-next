import { DatabaseResumingException, RDSDataClient } from '@aws-sdk/client-rds-data';
import { decorateServiceException } from '@smithy/core/client';
import { drizzle } from 'drizzle-orm/aws-data-api/pg';

// 共有のAuroraへData API経由で接続します。接続先は呼び出し元が渡します。認証情報はAWS SDKの既定の取得順で得ます。
// Auroraが自動停止から再開している間は、SDKの標準の再試行（ジッター付きの指数バックオフ）で待ちます。
// 再開中のData APIは1回に数秒かかります。再開は15秒以内に終わるため、試行回数は余裕を持って10回にします。
export const createDatabase = (config: { region: string; database: string; secretArn: string; resourceArn: string }) => {
  const client = new RDSDataClient({ region: config.region, maxAttempts: 10 });
  // 再開中の例外に再試行できる印を付け、SDKの再試行の対象にします。
  client.middlewareStack.add(
    (next) => async (args) => {
      try {
        return await next(args);
      } catch (error) {
        if (error instanceof DatabaseResumingException) {
          throw decorateServiceException(error, { $retryable: {} });
        }
        throw error;
      }
    },
    { step: 'finalizeRequest', priority: 'low', name: 'databaseResumingRetryable' },
  );
  return drizzle({
    client,
    database: config.database,
    secretArn: config.secretArn,
    resourceArn: config.resourceArn,
  });
};

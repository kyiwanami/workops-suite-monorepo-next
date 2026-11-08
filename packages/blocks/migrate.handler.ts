import { DatabaseResumingException, RDSDataClient } from '@aws-sdk/client-rds-data';
import type { CdkCustomResourceHandler, CdkCustomResourceIsCompleteHandler } from 'aws-lambda';
import { drizzle } from 'drizzle-orm/aws-data-api/pg';
import { migrate } from 'drizzle-orm/aws-data-api/pg/migrator';

// デプロイのたびに同じリソースとして扱うため、物理IDを固定します。
export const onEvent: CdkCustomResourceHandler = async () => ({ PhysicalResourceId: 'drizzle-migrations' });

// 未適用のマイグレーションをData API経由で適用します。マイグレーションはLambdaレイヤーとして/optに置かれます。
// 自動停止したDBが再開中のときは未完了を返し、CDKのProviderが間隔を空けて呼び直します。
export const isComplete: CdkCustomResourceIsCompleteHandler = async (event) => {
  if (event.RequestType === 'Delete') {
    return { IsComplete: true };
  }
  const db = drizzle({
    client: new RDSDataClient(),
    database: String(process.env.DATABASE_NAME),
    secretArn: String(process.env.SECRET_ARN),
    resourceArn: String(process.env.CLUSTER_ARN),
  });
  try {
    await migrate(db, { migrationsFolder: '/opt' });
  } catch (error) {
    if (error instanceof DatabaseResumingException || (error instanceof Error && error.cause instanceof DatabaseResumingException)) {
      return { IsComplete: false };
    }
    throw error;
  }
  return { IsComplete: true };
};

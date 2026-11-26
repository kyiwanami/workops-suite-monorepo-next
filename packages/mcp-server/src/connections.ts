import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { createDatabase } from '@workops/domain/database';

// 共有の Aurora と Cognito への接続です。接続先は Runtime の環境変数から読みます。
// 要求のたびに作らず、Runtime の実行環境の中で使い回します。
export const db = createDatabase({
  region: process.env.AWS_REGION,
  database: process.env.DATABASE_NAME,
  secretArn: process.env.SECRET_ARN,
  resourceArn: process.env.CLUSTER_ARN,
});
export const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
export const userPoolId = process.env.USER_POOL_ID;

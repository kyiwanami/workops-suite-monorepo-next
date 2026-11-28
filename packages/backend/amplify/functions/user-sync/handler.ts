import { env } from '$amplify/env/user-sync';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { createDatabase } from '@workops/domain/database';
import { syncAllUsers, syncUser } from '@workops/domain/users';
import type { EventBridgeHandler } from 'aws-lambda';
import { z } from 'zod';

// 共有のAuroraと Cognito への接続です。呼び出しのたびに作らず、Lambdaの実行環境の中で使い回します。
const db = createDatabase({
  region: env.AWS_REGION,
  database: env.DATABASE_NAME,
  secretArn: env.SECRET_ARN,
  resourceArn: env.CLUSTER_ARN,
});
const cognito = new CognitoIdentityProviderClient({ region: env.AWS_REGION });

// CloudTrail が記録した Cognito の操作の詳細のうち、使う項目です。操作した利用者の識別子は additionalEventData.sub に入ります。
// スキーマレジストリの公式の型では additionalEventData の中身が決まっていないため、実行時に確かめます。
const detailSchema = z.object({ eventName: z.string(), additionalEventData: z.object({ sub: z.string() }) });

// Cognito の利用者の操作のイベントを受け、その利用者を Cognito の今の状態で DB に反映します。
// ほかの環境のユーザープールの利用者は、自分のプールにいないため、DB にない行の削除になり何も変わりません。
// 詳細のない呼び出し（初回の取り込み）では、全件を反映します。
export const handler: EventBridgeHandler<'AWS API Call via CloudTrail', object | undefined, void> = async (event) => {
  if (event.detail === undefined) {
    await syncAllUsers(db, cognito, env.USER_POOL_ID);
    console.log(JSON.stringify({ event: 'userSync', scope: 'all' }));
    return;
  }
  const { eventName, additionalEventData } = detailSchema.parse(event.detail);
  await syncUser(db, cognito, env.USER_POOL_ID, additionalEventData.sub);
  console.log(JSON.stringify({ event: 'userSync', eventName, sub: additionalEventData.sub }));
};

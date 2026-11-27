import { env } from '$amplify/env/pre-token-generation';
import { createDatabase } from '@workops/domain/database';
import { getMembership } from '@workops/domain/membership';
import type { PreTokenGenerationV2TriggerHandler } from 'aws-lambda';

// 共有のAuroraへの接続です。呼び出しのたびに作らず、Lambdaの実行環境の中で使い回します。
const db = createDatabase({
  region: env.AWS_REGION,
  database: env.DATABASE_NAME,
  secretArn: env.SECRET_ARN,
  resourceArn: env.CLUSTER_ARN,
});

// アクセストークンに、利用者のトークンであることを示す principal_type と、ロールと全体管理者区分を入れます。
// チャットのAPIとHarnessは principal_type で利用者のトークンだけを受け付けます。この関数はマシン間の認可のトークンでは動かないため、そのトークンには入りません。
// AIの機能は、ロールと全体管理者区分でツールを使えるかを決めます。所属がない利用者には入れません。
export const handler: PreTokenGenerationV2TriggerHandler = async (event) => {
  const membership = await getMembership(db, event.request.userAttributes.sub);
  event.response.claimsAndScopeOverrideDetails = {
    accessTokenGeneration: {
      claimsToAddOrOverride: {
        principal_type: 'user',
        ...(membership === null ? {} : { app_role: membership.role, app_admin: String(membership.isAdmin) }),
      },
    },
  };
  return event;
};

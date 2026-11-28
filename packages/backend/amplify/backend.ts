import { createHash } from 'node:crypto';
import { defineBackend } from '@aws-amplify/backend';
import { createBlocksBackend } from '@workops/blocks/cdk';
import { Stack } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import {
  FeaturePlan,
  LambdaVersion,
  ManagedLoginVersion,
  OAuthScope,
  ResourceServerScope,
  UserPool,
  UserPoolOperation,
} from 'aws-cdk-lib/aws-cognito';
import { createAiBackend } from './ai';
import { chat } from './functions/chat/resource';
import { gatewayInterceptor } from './functions/gateway-interceptor/resource';
import { preTokenGeneration } from './functions/pre-token-generation/resource';
import { userSync } from './functions/user-sync/resource';

const app = defineBackend({ preTokenGeneration, gatewayInterceptor, chat, userSync });

// Blocks の Aurora と、デプロイ時に Drizzle のマイグレーションを適用する仕組みを構築します。
const database = await createBlocksBackend(app.createStack('blocks'));

// 全アプリで共有するユーザープールです。メールでログインし、利用者が自分で登録できます。
// トークン交換とアクセストークンへの値の追加を使うため、Essentials プランにします。
// トークン生成前の関数と同じ auth のスタックに置きます。
const stack = Stack.of(app.preTokenGeneration.resources.lambda);
const userPool = new UserPool(stack, 'UserPool', {
  signInAliases: { email: true },
  selfSignUpEnabled: true,
  featurePlan: FeaturePlan.ESSENTIALS,
});

// 全アプリで共有するログイン画面のドメインです。プレフィックスはバックエンドごとに一意で、デプロイしても変わりません。
// ログイン画面はマネージドログインで表示し、見た目は各アプリのクライアントに割り当てるスタイルで決めます。
const prefix = createHash('sha256').update(app.stack.stackName).digest('hex').slice(0, 20);
userPool.addDomain('LoginDomain', {
  cognitoDomain: { domainPrefix: `workops-${prefix}` },
  managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
});

// チャットの経路のトークンに付けるスコープです。
const chatScope = new ResourceServerScope({
  scopeName: 'chat',
  scopeDescription: 'チャットAPIと、チャットから業務のツールを呼ぶGateway',
});
const resourceServer = userPool.addResourceServer('ResourceServer', {
  identifier: 'workops',
  scopes: [chatScope],
});

// トークンを作る前に、利用者のロールと全体管理者区分をアクセストークンに入れます。所属は共有の Aurora から読みます。
app.preTokenGeneration.addEnvironment('DATABASE_NAME', database.databaseName);
app.preTokenGeneration.addEnvironment('SECRET_ARN', database.secretArn);
app.preTokenGeneration.addEnvironment('CLUSTER_ARN', database.cluster.clusterArn);
database.cluster.grantDataApiAccess(app.preTokenGeneration.resources.lambda);
userPool.addTrigger(
  UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
  app.preTokenGeneration.resources.lambda,
  LambdaVersion.V2_0,
);

// Cognito の利用者の操作（管理コンソールからの操作も含む）を、DB の利用者に反映します。
// 操作は、アカウントの CloudTrail の証跡が記録し、EventBridge が受けます。証跡は構築の手順で作ります（README）。
for (const [name, value] of Object.entries({
  DATABASE_NAME: database.databaseName,
  SECRET_ARN: database.secretArn,
  CLUSTER_ARN: database.cluster.clusterArn,
  USER_POOL_ID: userPool.userPoolId,
})) {
  app.userSync.addEnvironment(name, value);
}
database.cluster.grantDataApiAccess(app.userSync.resources.lambda);
userPool.grant(app.userSync.resources.lambda, 'cognito-idp:ListUsers');
new Rule(stack, 'UserSyncRule', {
  eventPattern: {
    source: ['aws.cognito-idp'],
    detailType: ['AWS API Call via CloudTrail'],
    detail: {
      eventSource: ['cognito-idp.amazonaws.com'],
      eventName: [
        'AdminCreateUser',
        'SignUp',
        'ConfirmSignUp',
        'AdminConfirmSignUp',
        'AdminUpdateUserAttributes',
        'UpdateUserAttributes',
        'AdminDeleteUserAttributes',
        'DeleteUserAttributes',
        'AdminEnableUser',
        'AdminDisableUser',
        'AdminDeleteUser',
        'DeleteUser',
      ],
    },
  },
  targets: [new LambdaFunction(app.userSync.resources.lambda)],
});

// Gateway のインターセプターが、トークンを検証するためのユーザープールです。
app.gatewayInterceptor.addEnvironment('USER_POOL_ID', userPool.userPoolId);

// AI機能のスタックです。Gateway のインターセプターと同じスタックに置きます。
const ai = createAiBackend({
  stack: Stack.of(app.gatewayInterceptor.resources.lambda),
  userPool,
  chatScope: OAuthScope.resourceServer(resourceServer, chatScope),
  cluster: database.cluster,
  databaseName: database.databaseName,
  gatewayInterceptor: app.gatewayInterceptor.resources.lambda,
  chatFunction: app.chat.resources.lambda,
});

// チャットのAPIの処理が読む値です。
for (const [name, value] of Object.entries({
  ...ai.chat.environment,
  DATABASE_NAME: database.databaseName,
  SECRET_ARN: database.secretArn,
  CLUSTER_ARN: database.cluster.clusterArn,
})) {
  app.chat.addEnvironment(name, value);
}

// 各アプリがクライアントを作るときと、サーバー側の処理で読む値です。
app.addOutput({
  auth: { aws_region: stack.region, user_pool_id: userPool.userPoolId },
  custom: {
    database: { clusterArn: database.cluster.clusterArn, secretArn: database.secretArn, databaseName: database.databaseName },
    authDomain: `workops-${prefix}.auth.${stack.region}.amazoncognito.com`,
    gatewayUrl: ai.gatewayUrl,
    chatApiUrl: ai.chat.apiUrl,
  },
});

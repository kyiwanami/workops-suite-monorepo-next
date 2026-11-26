import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { defineBackend } from '@aws-amplify/backend';
import { createBlocksBackend } from '@workops/blocks/cdk';
import { CfnResource, Duration, Stack } from 'aws-cdk-lib';
import {
  CfnUserPoolClient,
  FeaturePlan,
  LambdaVersion,
  ManagedLoginVersion,
  OAuthScope,
  ResourceServerScope,
  UserPool,
  UserPoolOperation,
} from 'aws-cdk-lib/aws-cognito';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { preTokenGeneration } from './functions/pre-token-generation/resource';
import { mcpClientProviders } from './mcp-clients';

const app = defineBackend({ preTokenGeneration });

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

// AIの機能のトークンに付けるスコープです。宛先ごとにトークンを分けます。
const chatScope = new ResourceServerScope({
  scopeName: 'chat',
  scopeDescription: 'チャットAPIと、チャットから業務のツールを呼ぶGateway',
});
const mcpScope = new ResourceServerScope({
  scopeName: 'mcp',
  scopeDescription: '外部のMCPクライアントから業務のツールを呼ぶGateway',
});
const resourceServer = userPool.addResourceServer('ResourceServer', {
  identifier: 'workops',
  scopes: [chatScope, mcpScope],
});

// トークンを作る前に、利用者のロールと全体管理者区分をアクセストークンに入れます。所属は共有の Aurora から読みます。
app.preTokenGeneration.addEnvironment('DATABASE_NAME', database.databaseName);
app.preTokenGeneration.addEnvironment('SECRET_ARN', database.secretArn);
app.preTokenGeneration.addEnvironment('CLUSTER_ARN', database.clusterArn);
app.preTokenGeneration.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['rds-data:ExecuteStatement'], resources: [database.clusterArn] }),
);
app.preTokenGeneration.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['secretsmanager:GetSecretValue'], resources: [database.secretArn] }),
);
userPool.addTrigger(
  UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
  app.preTokenGeneration.resources.lambda,
  LambdaVersion.V2_0,
);

// 外部のMCPクライアント（Claude Code・Codex など）がログインするクライアントです。
// クライアントは自分のメタデータ文書の URL を ID として名乗り、戻り先はその文書の redirect_uris から取られます。
// 認可コードのフローには戻り先の登録が要るため、手元で動くクライアントの戻り先（任意のポート）を登録します。
const mcpClient = userPool.addClient('McpClient', {
  generateSecret: false,
  oAuth: {
    flows: { authorizationCodeGrant: true },
    scopes: [OAuthScope.resourceServer(resourceServer, mcpScope)],
    callbackUrls: ['http://localhost'],
  },
  refreshTokenRotationGracePeriod: Duration.seconds(10),
  preventUserExistenceErrors: true,
});

// メタデータ文書で名乗ることを認める MCP クライアントを、提供元ごとに外部のMCPクライアント用のクライアントへ紐づけます。
// aws-cdk-lib にこのリソースの型がないため、CloudFormation のリソースを直接書きます。
// クライアント側の文書の変更に早く追従するため、文書を保持する時間は最小の1日にします。
for (const provider of mcpClientProviders) {
  new CfnResource(stack, `CimdPolicy-${provider.name}`, {
    type: 'AWS::Cognito::CIMDPolicy',
    properties: {
      UserPoolId: userPool.userPoolId,
      ClientId: mcpClient.userPoolClientId,
      PolicyName: provider.name,
      URLPatterns: provider.urls,
      CacheDuration: Duration.days(1).toSeconds(),
    },
  });
}

// チャットの経路で、Webアプリのトークンを Gateway 用のトークンに交換するクライアントです。
// 交換で発行できるのは元のトークンにあるスコープだけのため、Webアプリと同じ workops/chat を持たせます。
const tokenExchangeClient = userPool.addClient('TokenExchangeClient', {
  generateSecret: true,
  oAuth: { flows: { clientCredentials: true }, scopes: [OAuthScope.resourceServer(resourceServer, chatScope)] },
  accessTokenValidity: Duration.minutes(60),
});
const tokenExchangeClientResource = tokenExchangeClient.node.defaultChild;
assert(tokenExchangeClientResource instanceof CfnUserPoolClient);
tokenExchangeClientResource.explicitAuthFlows = ['ALLOW_TOKEN_EXCHANGE_IMPERSONATION'];

// 各アプリがクライアントを作るときと、サーバー側の処理で読む値です。
app.addOutput({
  auth: { aws_region: stack.region, user_pool_id: userPool.userPoolId },
  custom: { database, authDomain: `workops-${prefix}.auth.${stack.region}.amazoncognito.com` },
});

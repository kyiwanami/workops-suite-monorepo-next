import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArnFormat, AssetHashType, CfnResource, CustomResource, DockerImage, Duration, Names, Stack } from 'aws-cdk-lib';
import {
  AgentCoreRuntime,
  AgentRuntimeArtifact,
  CfnGatewayRateLimit,
  CfnResourcePolicy,
  Gateway,
  GatewayAuthorizer,
  GatewayCredentialProvider,
  GatewayExceptionLevel,
  GatewayProtocol,
  GatewayTarget,
  LambdaInterceptor,
  MCPProtocolVersion,
  PolicyEngine,
  PolicyEngineMode,
  ProtocolType,
  Runtime,
} from 'aws-cdk-lib/aws-bedrockagentcore';
import {
  CfnManagedLoginBranding,
  CfnUserPoolClient,
  OAuthScope,
  ResourceServerScope,
  UserPool,
  UserPoolResourceServer,
} from 'aws-cdk-lib/aws-cognito';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import type { DatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { CfnDelivery, CfnDeliveryDestination, CfnDeliverySource, LogGroup, LogRetention, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import domainPackage from '../../domain/package.json';
import { buildSync } from 'esbuild';
import { mcpClientProviders } from './mcp-clients';
import { createPolicies } from './policies';

// 業務MCPサーバーのパッケージと、Runtime で動かすための自動計装のパッケージです。
const serverPath = fileURLToPath(new URL('../../mcp-server', import.meta.url));
const instrumentation = '@aws/aws-distro-opentelemetry-node-autoinstrumentation';

// AI機能のスタックです。業務MCPサーバー（Runtime）と、外部のMCPクライアントやチャットから業務のツールを呼ぶ Gateway を作ります。
export function createAiBackend(props: {
  stack: Stack;
  userPool: UserPool;
  chatScope: OAuthScope;
  cluster: DatabaseCluster;
  databaseName: string;
  gatewayInterceptor: IFunction;
  synchronizeGatewayTarget: IFunction;
  waitGatewayTarget: IFunction;
}) {
  const { stack, userPool, cluster } = props;
  assert(cluster.secret);

  // ユーザープールのリソースは、ユーザープールと同じスタックに置きます。
  const userPoolStack = Stack.of(userPool);

  // 外部のMCPクライアント（Claude Code・Codex など）がログインするクライアントです。
  // クライアントは自分のメタデータ文書の URL を ID として名乗り、戻り先はその文書の redirect_uris から取られます。
  // 認可コードのフローには戻り先の登録が要るため、手元で動くクライアントの戻り先（任意のポート）と、
  // 提供元のクライアントがこのクライアントの ID で接続するときの戻り先を登録します。
  // クライアントは接続先の Gateway の URL を resource として要求し、Cognito はその URL を aud に入れたトークンを発行します。
  // 標準のスコープだけを許します。Gateway はクライアントの ID で受け付けを判定します。
  const mcpClient = userPool.addClient('McpClient', {
    generateSecret: false,
    oAuth: {
      flows: { authorizationCodeGrant: true },
      scopes: [OAuthScope.OPENID],
      callbackUrls: ['http://localhost', ...mcpClientProviders.flatMap((provider) => provider.callbackUrls)],
    },
    refreshTokenRotationGracePeriod: Duration.seconds(10),
    preventUserExistenceErrors: true,
  });

  // 外部のMCPクライアント用のクライアントのログイン画面に、Cognito の標準のスタイルを割り当てます。
  new CfnManagedLoginBranding(userPoolStack, 'McpClientLoginBranding', {
    userPoolId: userPool.userPoolId,
    clientId: mcpClient.userPoolClientId,
    useCognitoProvidedValues: true,
  });

  // メタデータ文書で名乗ることを認める MCP クライアントを、提供元ごとに外部のMCPクライアント用のクライアントへ紐づけます。
  // aws-cdk-lib にこのリソースの型がないため、CloudFormation のリソースを直接書きます。
  // クライアント側の文書の変更に早く追従するため、文書を保持する時間は最小の1日にします。
  for (const provider of mcpClientProviders) {
    new CfnResource(userPoolStack, `CimdPolicy-${provider.name}`, {
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
  // 交換で発行できるのは元のトークンにあるスコープだけのため、Webアプリと同じチャットのスコープを持たせます。
  const tokenExchangeClient = userPool.addClient('TokenExchangeClient', {
    generateSecret: true,
    oAuth: { flows: { clientCredentials: true }, scopes: [props.chatScope] },
    accessTokenValidity: Duration.minutes(60),
  });
  const tokenExchangeClientResource = tokenExchangeClient.node.defaultChild;
  assert(tokenExchangeClientResource instanceof CfnUserPoolClient);
  tokenExchangeClientResource.explicitAuthFlows = ['ALLOW_TOKEN_EXCHANGE_IMPERSONATION'];

  // 業務MCPサーバーです。1つのファイルに束ね、自動計装と AWS SDK のパッケージは node_modules に入れて同梱します。
  // 自動計装は、実行時に読み込まれた AWS SDK にフックをかけてスパンを作るため、AWS SDK は束ねません。版は業務の処理と同じにします。
  // 自動計装は CommonJS でだけ動くため、CommonJS で束ねます。
  const awsSdk = Object.fromEntries(
    Object.entries(domainPackage.dependencies).filter(([name]) => name.startsWith('@aws-sdk/') || name.startsWith('@smithy/')),
  );
  const runtime = new Runtime(stack, 'McpServer', {
    agentRuntimeArtifact: AgentRuntimeArtifact.fromCodeAsset({
      path: serverPath,
      runtime: AgentCoreRuntime.NODE_22,
      entrypoint: ['opentelemetry-instrument', 'dist/index.js'],
      assetHashType: AssetHashType.OUTPUT,
      bundling: {
        image: DockerImage.fromRegistry('node:22'),
        local: {
          tryBundle(outputDir) {
            buildSync({
              entryPoints: [path.join(serverPath, 'src/index.ts')],
              outfile: path.join(outputDir, 'dist/index.js'),
              bundle: true,
              platform: 'node',
              target: 'node22',
              format: 'cjs',
              external: [instrumentation, ...Object.keys(awsSdk)],
            });
            writeFileSync(
              path.join(outputDir, 'package.json'),
              JSON.stringify({ private: true, engines: { node: '>=22' }, dependencies: { [instrumentation]: '0.15.0', ...awsSdk } }),
            );
            execSync('npm install --omit=dev --no-package-lock --no-audit --no-fund', { cwd: outputDir, stdio: 'inherit' });
            return true;
          },
        },
      },
    }),
    protocolConfiguration: ProtocolType.MCP,
    tracingEnabled: true,
    environmentVariables: {
      DATABASE_NAME: props.databaseName,
      SECRET_ARN: cluster.secret.secretArn,
      CLUSTER_ARN: cluster.clusterArn,
      USER_POOL_ID: userPool.userPoolId,
    },
  });
  cluster.grantDataApiAccess(runtime);
  // 担当者・申請者の名前を表示するため、ユーザープールの利用者を読みます。
  userPool.grant(runtime, 'cognito-idp:ListUsers');
  // 自動計装がスパンを Runtime のロググループに出すために要ります。Runtime の ID はこの権限のあとで決まるため、Runtime のロググループ全体を対象にします。
  runtime.addToRolePolicy(
    new PolicyStatement({
      actions: ['logs:PutResourcePolicy'],
      resources: [
        stack.formatArn({
          service: 'logs',
          resource: 'log-group',
          resourceName: '/aws/bedrock-agentcore/runtimes/*',
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
        }),
      ],
    }),
  );
  // 本文が入るログは90日残します。
  new LogRetention(stack, 'McpServerLogRetention', {
    logGroupName: `/aws/bedrock-agentcore/runtimes/${runtime.agentRuntimeId}-DEFAULT`,
    retention: RetentionDays.THREE_MONTHS,
  });

  // ツールの呼び出しを、ロールごとに許可するポリシーを評価する仕組みです。
  const policyEngine = new PolicyEngine(stack, 'PolicyEngine');

  // Gateway です。外部のMCPクライアント用とトークン交換用のクライアント、メタデータ文書で名乗る MCP クライアントのトークンだけを受け付けます。
  // メタデータ文書で名乗るクライアントのトークンは、文書の URL がクライアントの ID になります。ワイルドカードを含む URL は照合できないため除きます。
  const sandbox = stack.node.tryGetContext('amplify-backend-type') === 'sandbox';
  const metadataUrls = mcpClientProviders.flatMap((provider) => provider.urls).filter((url) => !url.includes('*'));
  const gateway = new Gateway(stack, 'Gateway', {
    protocolConfiguration: GatewayProtocol.mcp({
      supportedVersions: [MCPProtocolVersion.of('2025-11-25'), MCPProtocolVersion.of('2026-07-28')],
    }),
    authorizerConfiguration: GatewayAuthorizer.usingCustomJwt({
      discoveryUrl: `https://cognito-idp.${stack.region}.amazonaws.com/${userPool.userPoolId}/.well-known/openid-configuration`,
      allowedClients: [mcpClient.userPoolClientId, tokenExchangeClient.userPoolClientId, ...metadataUrls],
    }),
    interceptorConfigurations: [LambdaInterceptor.forRequest(props.gatewayInterceptor, { passRequestHeaders: true })],
    policyEngineConfiguration: { policyEngine, mode: PolicyEngineMode.ENFORCE },
    // 失敗の詳細は、検証の環境でだけ返します。
    ...(sandbox ? { exceptionLevel: GatewayExceptionLevel.DEBUG } : {}),
  });
  // ツール結果の攻撃の検知で、Bedrock のガードレールを呼びます。
  gateway.role.addToPrincipalPolicy(new PolicyStatement({ actions: ['bedrock:InvokeGuardrailChecks'], resources: ['*'] }));
  assert(gateway.gatewayUrl !== undefined);

  // Gateway の URL を識別子にしたリソースサーバーです。MCP クライアントは Gateway の URL を resource としてトークンを要求し、
  // Cognito は登録したリソースサーバーの URL だけを受け付けて、トークンの aud にその URL を入れます。
  new UserPoolResourceServer(stack, 'GatewayResourceServer', {
    userPool,
    identifier: gateway.gatewayUrl,
    userPoolResourceServerName: 'gateway',
    scopes: [new ResourceServerScope({ scopeName: 'invoke', scopeDescription: 'Gateway の業務のツールを呼ぶ' })],
  });

  // 業務MCPサーバーを呼べるのは Gateway だけにします。
  const runtimePolicy = new CfnResourcePolicy(stack, 'McpServerPolicy', {
    resourceArn: runtime.agentRuntimeArn,
    policy: stack.toJsonString({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: gateway.role.roleArn },
          Action: 'bedrock-agentcore:InvokeAgentRuntime',
          Resource: runtime.agentRuntimeArn,
        },
        {
          Effect: 'Deny',
          Principal: '*',
          Action: 'bedrock-agentcore:InvokeAgentRuntime',
          Resource: runtime.agentRuntimeArn,
          Condition: { ArnNotEquals: { 'aws:PrincipalArn': gateway.role.roleArn } },
        },
      ],
    }),
  });

  // 業務MCPサーバーを Gateway のツールの提供元にします。ターゲットの名前がツールの公開名の接頭辞になります。
  // URL の中の Runtime の ARN は、URL エンコードした形で書きます。
  const encodedRuntimeArn = `arn%3A${stack.partition}%3Abedrock-agentcore%3A${stack.region}%3A${stack.account}%3Aruntime%2F${runtime.agentRuntimeId}`;
  const target = GatewayTarget.forMcpServer(stack, 'McpServerTarget', {
    gateway,
    gatewayTargetName: 'workops',
    endpoint: `https://bedrock-agentcore.${stack.region}.amazonaws.com/runtimes/${encodedRuntimeArn}/invocations?qualifier=DEFAULT`,
    credentialProviderConfigurations: [GatewayCredentialProvider.fromIamRole({ service: 'bedrock-agentcore' })],
  });
  // ターゲットを作るときに Gateway がツールの定義を読むため、先に呼び出しを許可します。
  runtime.grantInvokeRuntime(gateway.role).applyBefore(target);
  target.node.addDependency(runtimePolicy);

  // 業務MCPサーバーを更新したら、Gateway にツールの定義を取り直させ、終わるまでデプロイを待ちます。
  target.grantSync(props.synchronizeGatewayTarget);
  props.waitGatewayTarget.addToRolePolicy(
    new PolicyStatement({ actions: ['bedrock-agentcore:GetGatewayTarget'], resources: [gateway.gatewayArn, `${gateway.gatewayArn}/*`] }),
  );
  const provider = new Provider(stack, 'TargetSyncProvider', {
    onEventHandler: props.synchronizeGatewayTarget,
    isCompleteHandler: props.waitGatewayTarget,
  });
  const synchronization = new CustomResource(stack, 'TargetSync', {
    serviceToken: provider.serviceToken,
    properties: { gatewayIdentifier: gateway.gatewayId, targetId: target.targetId, runtimeVersion: runtime.agentRuntimeVersion },
  });

  // ツールの呼び出しを評価するポリシーです。
  createPolicies({ stack, policyEngine, gateway, synchronization });

  // 利用者ごとに、ツールの呼び出しを毎分60回までにします。
  new CfnGatewayRateLimit(stack, 'RateLimit', {
    gatewayIdentifier: gateway.gatewayId,
    dimensionKeys: ['$.context.jwt.sub'],
    entries: [{ dimensions: { '$.context.jwt.sub': '*' }, requests: [{ rate: 60, period: 'minute' }] }],
  });

  // Gateway のログを CloudWatch Logs に、トレースを X-Ray に送ります。本文が入るログは90日残します。
  const logGroup = new LogGroup(stack, 'GatewayLogs', {
    logGroupName: `/aws/vendedlogs/bedrock-agentcore/gateway/APPLICATION_LOGS/${gateway.gatewayId}`,
    retention: RetentionDays.THREE_MONTHS,
  });
  const deliveries = [
    { name: 'logs', logType: 'APPLICATION_LOGS', destination: { destinationResourceArn: logGroup.logGroupArn } },
    { name: 'traces', logType: 'TRACES', destination: { deliveryDestinationType: 'XRAY' } },
  ];
  for (const { name, logType, destination } of deliveries) {
    const deliveryName = `${Names.uniqueResourceName(gateway, { maxLength: 40 })}-${name}`;
    const source = new CfnDeliverySource(stack, `GatewayDeliverySource-${name}`, {
      name: deliveryName,
      logType,
      resourceArn: gateway.gatewayArn,
    });
    const deliveryDestination = new CfnDeliveryDestination(stack, `GatewayDeliveryDestination-${name}`, {
      name: deliveryName,
      ...destination,
    });
    new CfnDelivery(stack, `GatewayDelivery-${name}`, {
      deliverySourceName: source.name,
      deliveryDestinationArn: deliveryDestination.attrArn,
    }).addDependency(source);
  }

  return { gatewayUrl: gateway.gatewayUrl };
}

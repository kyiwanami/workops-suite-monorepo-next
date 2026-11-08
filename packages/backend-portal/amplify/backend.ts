import { defineBackend } from '@aws-amplify/backend';
import outputs from '@workops/backend/outputs';
import { CfnManagedLoginBranding, OAuthScope, UserPool } from 'aws-cdk-lib/aws-cognito';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

// ポータルのアプリクライアントを、共有のユーザープールに作ります。
// Hosting では組み込みの環境変数からアプリの URL を作り、手元では localhost を使います。
const origin =
  process.env.AWS_APP_ID === undefined
    ? 'http://localhost:3000'
    : `https://${process.env.AWS_BRANCH}.${process.env.AWS_APP_ID}.amplifyapp.com`;
const signInUrl = `${origin}/api/auth/sign-in-callback`;
const signOutUrl = `${origin}/api/auth/sign-out-callback`;
const scopes = [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE, OAuthScope.COGNITO_ADMIN];

const app = defineBackend({});
const stack = app.createStack('auth');
const userPool = UserPool.fromUserPoolId(stack, 'SharedUserPool', outputs.auth.user_pool_id);
const client = userPool.addClient('PortalClient', {
  oAuth: { flows: { authorizationCodeGrant: true }, scopes, callbackUrls: [signInUrl], logoutUrls: [signOutUrl] },
  preventUserExistenceErrors: true,
});

// ポータルのクライアントのログイン画面に、Cognito の標準のスタイルを割り当てます。
new CfnManagedLoginBranding(stack, 'LoginBranding', {
  userPoolId: outputs.auth.user_pool_id,
  clientId: client.userPoolClientId,
  useCognitoProvidedValues: true,
});

// Hosting のポータルが、サーバー側の処理で共有の Aurora を Data API で読み書きするための Compute ロールです。
// 手元の開発サーバーは起動時のプロファイルで接続するため、Hosting のときだけ作ります。
if (process.env.AWS_APP_ID !== undefined) {
  const computeRole = new Role(app.createStack('compute'), 'ComputeRole', {
    assumedBy: new ServicePrincipal('amplify.amazonaws.com'),
  });
  computeRole.addToPolicy(
    new PolicyStatement({
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
        'rds-data:BeginTransaction',
        'rds-data:CommitTransaction',
        'rds-data:RollbackTransaction',
      ],
      resources: [outputs.custom.database.clusterArn],
    }),
  );
  computeRole.addToPolicy(
    new PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [outputs.custom.database.secretArn],
    }),
  );
}

// ポータルが読む設定です。共有のユーザープールとログイン画面に、ポータルのクライアントと戻り先を合わせます。
app.addOutput({
  auth: {
    aws_region: outputs.auth.aws_region,
    user_pool_id: outputs.auth.user_pool_id,
    user_pool_client_id: client.userPoolClientId,
    oauth: {
      domain: outputs.custom.authDomain,
      scopes: scopes.map((scope) => scope.scopeName),
      redirect_sign_in_uri: [signInUrl],
      redirect_sign_out_uri: [signOutUrl],
      response_type: 'code',
      identity_providers: [],
    },
  },
});

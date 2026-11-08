import { defineBackend } from '@aws-amplify/backend';
import outputs from '@workops/backend/outputs';
import { CfnManagedLoginBranding, OAuthScope, UserPool } from 'aws-cdk-lib/aws-cognito';
import { Rule } from 'aws-cdk-lib/aws-events';
import { AwsApi } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

// 資産カタログのアプリクライアントを、共有のユーザープールに作ります。
// Hosting では組み込みの環境変数からアプリの URL を作り、手元では localhost を使います。
const origin =
  process.env.AWS_APP_ID === undefined
    ? 'http://localhost:3001'
    : `https://${process.env.AWS_BRANCH}.${process.env.AWS_APP_ID}.amplifyapp.com`;
const signInUrl = `${origin}/api/auth/sign-in-callback`;
const signOutUrl = `${origin}/api/auth/sign-out-callback`;
const scopes = [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE, OAuthScope.COGNITO_ADMIN];

const app = defineBackend({});
const stack = app.createStack('auth');
const userPool = UserPool.fromUserPoolId(stack, 'SharedUserPool', outputs.auth.user_pool_id);
const client = userPool.addClient('AssetClient', {
  oAuth: { flows: { authorizationCodeGrant: true }, scopes, callbackUrls: [signInUrl], logoutUrls: [signOutUrl] },
  preventUserExistenceErrors: true,
});

// 資産カタログのクライアントのログイン画面に、Cognito の標準のスタイルを割り当てます。
new CfnManagedLoginBranding(stack, 'LoginBranding', {
  userPoolId: outputs.auth.user_pool_id,
  clientId: client.userPoolClientId,
  useCognitoProvidedValues: true,
});

// 共有バックエンドの main のデプロイが成功したら、資産カタログのビルドを始めます。
// 資産カタログは共有バックエンドの出力を読むため、共有バックエンドのデプロイが終わってからビルドします。
if (process.env.AWS_APP_ID !== undefined) {
  const buildStack = app.createStack('build');
  new Rule(buildStack, 'BackendDeployed', {
    eventPattern: {
      source: ['aws.amplify'],
      detailType: ['Amplify Deployment Status Change'],
      detail: { appId: [process.env.BACKEND_APP_ID], branchName: ['main'], jobStatus: ['SUCCEED'] },
    },
    targets: [
      new AwsApi({
        service: 'Amplify',
        action: 'startJob',
        parameters: { appId: process.env.AWS_APP_ID, branchName: process.env.AWS_BRANCH, jobType: 'RELEASE' },
        policyStatement: new PolicyStatement({
          actions: ['amplify:StartJob'],
          resources: [
            `arn:aws:amplify:${buildStack.region}:${buildStack.account}:apps/${process.env.AWS_APP_ID}/branches/${process.env.AWS_BRANCH}/jobs/*`,
          ],
        }),
      }),
    ],
  });
}

// 資産カタログが読む設定です。共有のユーザープールとログイン画面に、資産カタログのクライアントと戻り先を合わせます。
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

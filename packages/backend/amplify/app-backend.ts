import { defineBackend } from '@aws-amplify/backend';
import { CfnManagedLoginBranding, OAuthScope, UserPool } from 'aws-cdk-lib/aws-cognito';
import { Rule } from 'aws-cdk-lib/aws-events';
import { AwsApi } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import outputs from '@workops/backend/outputs';

// 業務のアプリ（ポータル・資産カタログ・申請管理）のバックエンドを作ります。
// - clientName：共有のユーザープールに作るアプリクライアントの名前
// - port：手元の開発サーバーのポート
// - cognitoActions：Hosting のサーバー側の処理が、共有のユーザープールに対して行う操作
export function defineAppBackend({ clientName, port, cognitoActions }: { clientName: string; port: number; cognitoActions: string[] }) {
  // Hosting では組み込みの環境変数からアプリの URL を作り、手元では localhost を使います。
  const origin =
    process.env.AWS_APP_ID === undefined
      ? `http://localhost:${port}`
      : `https://${process.env.AWS_BRANCH}.${process.env.AWS_APP_ID}.amplifyapp.com`;
  const signInUrl = `${origin}/api/auth/sign-in-callback`;
  const signOutUrl = `${origin}/api/auth/sign-out-callback`;
  const scopes = [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE, OAuthScope.custom('workops/chat')];

  // アプリクライアントを、共有のユーザープールに作ります。
  const app = defineBackend({});
  const stack = app.createStack('auth');
  const userPool = UserPool.fromUserPoolId(stack, 'SharedUserPool', outputs.auth.user_pool_id);
  const client = userPool.addClient(clientName, {
    oAuth: { flows: { authorizationCodeGrant: true }, scopes, callbackUrls: [signInUrl], logoutUrls: [signOutUrl] },
    preventUserExistenceErrors: true,
  });

  // クライアントのログイン画面に、Cognito の標準のスタイルを割り当てます。
  new CfnManagedLoginBranding(stack, 'LoginBranding', {
    userPoolId: outputs.auth.user_pool_id,
    clientId: client.userPoolClientId,
    useCognitoProvidedValues: true,
  });

  // Hosting のアプリが、サーバー側の処理で共有の Aurora を Data API で読み書きし、共有のユーザープールを操作するための Compute ロールです。
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
    computeRole.addToPolicy(new PolicyStatement({ actions: cognitoActions, resources: [userPool.userPoolArn] }));

    // 共有バックエンドの main のデプロイが成功したら、アプリのビルドを始めます。
    // アプリは共有バックエンドの出力を読むため、共有バックエンドのデプロイが終わってからビルドします。
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

  // アプリが読む設定です。共有のユーザープールとログイン画面に、アプリのクライアントと戻り先を合わせます。
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
}

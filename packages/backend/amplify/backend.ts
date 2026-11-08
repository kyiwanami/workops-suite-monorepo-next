import { createHash } from 'node:crypto';
import { defineBackend } from '@aws-amplify/backend';
import { createBlocksBackend } from '@workops/blocks/cdk';
import { UserPool } from 'aws-cdk-lib/aws-cognito';

const app = defineBackend({});

// Blocks の Aurora と、デプロイ時に Drizzle のマイグレーションを適用する仕組みを構築します。
const database = await createBlocksBackend(app.createStack('blocks'));

// 全アプリで共有するユーザープールです。メールでログインし、利用者が自分で登録できます。
const stack = app.createStack('auth');
const userPool = new UserPool(stack, 'UserPool', {
  signInAliases: { email: true },
  selfSignUpEnabled: true,
});

// 全アプリで共有するログイン画面のドメインです。プレフィックスはバックエンドごとに一意で、デプロイしても変わりません。
const prefix = createHash('sha256').update(app.stack.stackName).digest('hex').slice(0, 20);
userPool.addDomain('LoginDomain', { cognitoDomain: { domainPrefix: `workops-${prefix}` } });

// 各アプリがクライアントを作るときと、サーバー側の処理で読む値です。
app.addOutput({
  auth: { aws_region: stack.region, user_pool_id: userPool.userPoolId },
  custom: { database, authDomain: `workops-${prefix}.auth.${stack.region}.amazoncognito.com` },
});

# workops-suite-monorepo-next

Amplify Gen 2の共有バックエンドを管理するnpm workspacesのモノレポです。Node.js 24を使用します。
共有のユーザープールとログイン画面のドメインは`packages/backend/amplify`、BlocksのAurora定義とDBスキーマは`packages/blocks`に配置しています。
`@workops/backend`はAmplify、`@workops/blocks`はBlocksとDBスキーマ・マイグレーションを管理するワークスペースです。
`amplify/backend.ts`でユーザープールとマネージドログインのドメインを作り、`@workops/blocks/cdk`を接続して、ユーザープールID・リージョン・ドメイン・DB接続情報を出力します。
Blocksの構築とDBのCDK設定は`packages/blocks/index.cdk.ts`で管理します。
DBのBlock定義は`packages/blocks/index.ts`、テーブル定義は`packages/blocks/schema.ts`に置きます。

```powershell
npm ci
npm run lint
npm run typecheck
```

DBアクセスにはDrizzle ORM v1を使用します。`schema.ts`がテーブル定義とTypeScriptの型の定義元です。
テーブル定義を変更したら、`packages/blocks`で次のコマンドを実行します。drizzle-kitが`packages/blocks/migrations`にマイグレーションを生成します。DBには接続しません。

```powershell
npx drizzle-kit generate --name <変更名>
```

マイグレーションは1件ごとのフォルダ（`migration.sql`と`snapshot.json`）に生成されます。`schema.ts`とマイグレーションのフォルダをGitで管理し、適用済みのマイグレーションは変更しません。
未適用のマイグレーションは、共有バックエンドのデプロイ中にカスタムリソースがDrizzleのマイグレーション（Data API経由）で適用します。適用履歴は`drizzle.__drizzle_migrations`に記録されます。

Aurora PostgreSQL 17.11をData API経由で使用します。容量は0～2 ACU、無操作300秒で自動停止します。
ストレージを暗号化します。sandboxの削除ポリシーはAmplify標準のDeleteを使用します。

サンドボックスはリポジトリルートで実行します。AWSリソースを作成・更新します。
新規構築・更新ともに次のコマンドでデプロイします。

```powershell
$env:AWS_REGION = 'ap-northeast-1'
npm run sandbox -- --profile amazon-connect --identifier workops-next --once
```

DB接続にはBlocksが生成する管理者用Secretを使用します。
テーブルの作成と変更は、デプロイ中のマイグレーションで実行します。

接続設定は`packages/backend/amplify_outputs.json`に自動生成されます。`auth`にユーザープールIDとリージョン、`custom.authDomain`にドメイン、`custom.database`にDB接続情報が入ります。
`clusterArn`、Blocks標準の`secretArn`、`databaseName`を出力し、認証情報の値はSecrets Managerで管理します。
このファイルは手動編集せず、Git管理から除外します。

## ポータル

ポータルのフロントエンドは`apps/portal`、ポータルのバックエンドは`packages/backend-portal`に配置しています。
ポータルのバックエンドは、共有のユーザープールにポータルのアプリクライアントを作り、マネージドログインのスタイルを割り当てます。
共有バックエンドの`amplify_outputs.json`を読むため、共有バックエンドのsandboxをデプロイしてから実行します。

```powershell
$env:AWS_REGION = 'ap-northeast-1'
npm run sandbox:portal -- --profile amazon-connect --identifier workops-portal --once
```

接続設定は`packages/backend-portal/amplify_outputs.json`に自動生成され、ポータルは`@workops/backend-portal/outputs`として読みます。
クライアントの戻り先は`http://localhost:3000`です。

`apps/portal/.env.local`に、ポータルのオリジンを書きます。

```dotenv
AMPLIFY_APP_ORIGIN=http://localhost:3000
```

開発サーバーは、DBに接続するプロファイルを指定して起動します。

```powershell
$env:AWS_PROFILE = 'amazon-connect'
npm run dev:portal
```

`http://localhost:3000`を開くと、共有のログイン画面へ転送されます。

## Hosting

Hostingのアプリは、共有バックエンドとポータルの2つです。どちらもリポジトリルートの`amplify.yml`でビルドします。

1. 共有バックエンドのアプリを、このリポジトリの`main`ブランチから作ります。
2. ポータルのアプリを、モノレポのルートを`apps/portal`にして作ります。サービスロールには、共有バックエンドのアプリのサービスロールを指定します。詳細設定の環境変数`BACKEND_APP_ID`に、共有バックエンドのアプリIDを入れます。
3. ポータルの最初のビルドで、ポータルのバックエンドがCompute ロールを作ります。このロールを、ポータルのアプリのCompute ロールに割り当てます。

サーバー側の処理は、Compute ロールで共有のAuroraをData API経由で読み書きします。

最初の管理者は手で登録します。共有のユーザープールにユーザーを作り、DBの`Department`に部署を、`UserMembership`にそのユーザーの`sub`と部署、`isAdmin`を`true`にした所属を登録します。

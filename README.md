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

## 資産カタログ

資産カタログのフロントエンドは`apps/asset`、資産カタログのバックエンドは`packages/backend-asset`に配置しています。
資産カタログのバックエンドは、共有のユーザープールに資産カタログのアプリクライアントを作り、マネージドログインのスタイルを割り当てます。
共有バックエンドのsandboxをデプロイしてから実行します。

```powershell
$env:AWS_REGION = 'ap-northeast-1'
npm run sandbox:asset -- --profile amazon-connect --identifier workops-asset --once
```

接続設定は`packages/backend-asset/amplify_outputs.json`に自動生成され、資産カタログは`@workops/backend-asset/outputs`として読みます。
クライアントの戻り先は`http://localhost:3001`です。

`apps/asset/.env.local`に、資産カタログのオリジンを書きます。

```dotenv
AMPLIFY_APP_ORIGIN=http://localhost:3001
```

開発サーバーは、DBに接続するプロファイルを指定して起動します。

```powershell
$env:AWS_PROFILE = 'amazon-connect'
npm run dev:asset
```

`http://localhost:3001`を開くと、共有のログイン画面へ転送されます。ポータルでログインしてから1時間以内は、ログイン画面を出さずにサインインします。

## 申請管理

申請管理のフロントエンドは`apps/request`、申請管理のバックエンドは`packages/backend-request`に配置しています。
資産カタログと同じ形で、sandboxは`npm run sandbox:request -- --profile amazon-connect --identifier workops-request --once`、開発サーバーは`npm run dev:request`で動かします。
クライアントの戻り先と`apps/request/.env.local`の`AMPLIFY_APP_ORIGIN`は、`http://localhost:3002`です。

## 共通UI

3つのアプリの見た目は、`packages/ui`（`@workops/ui`）にまとめています。色のトークン・書体・テーマは`src/styles/globals.css`、shadcn/uiの部品は`src/components`、共通のヘッダーなどWorkopsの部品は`src/workops`に置きます。
shadcn/uiの部品は、アプリのフォルダーで追加します。部品は`packages/ui/src/components`に入ります。

```powershell
cd apps/portal
npx shadcn@latest add <部品名>
```

ヘッダーのアプリの切替は、DBの`App`テーブルの`appId`・`name`・`urlDomain`から作ります。`urlDomain`には、環境ごとのアプリのURLを登録します。

## Hosting

Hostingのアプリは、共有バックエンド・ポータル・資産カタログ・申請管理の4つです。どれもリポジトリルートの`amplify.yml`でビルドします。

1. 共有バックエンドのアプリを、このリポジトリの`main`ブランチから作ります。
2. ポータルのアプリを、モノレポのルートを`apps/portal`にして作ります。サービスロールには、共有バックエンドのアプリのサービスロールを指定します。詳細設定の環境変数`BACKEND_APP_ID`に、共有バックエンドのアプリIDを入れます。
3. ポータルのアプリの`main`ブランチの自動ビルドを止めます。ポータルのビルドは、共有バックエンドのデプロイが成功したときに、ポータルのバックエンドが作るEventBridgeのルールで始まります。
4. ポータルの最初のビルドで、ポータルのバックエンドがCompute ロールを作ります。このロールを、ポータルのアプリのCompute ロールに割り当てます。
5. 資産カタログと申請管理のアプリを、モノレポのルートをそれぞれ`apps/asset`・`apps/request`にして、ポータルの2〜4と同じ設定で作ります。

サーバー側の処理は、Compute ロールで共有のAuroraをData API経由で読み書きします。

最初の管理者は手で登録します。共有のユーザープールにユーザーを作り、DBの`Department`に部署を、`UserMembership`にそのユーザーの`sub`と部署、`isAdmin`を`true`にした所属を登録します。

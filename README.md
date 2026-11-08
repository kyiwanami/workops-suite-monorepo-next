# workops-suite-monorepo-next

Amplify Gen 2の共有バックエンドを管理するnpm workspacesのモノレポです。Node.js 24を使用します。
共有のユーザープールとログイン画面のドメインは`packages/backend/amplify`、BlocksのAurora定義とDBスキーマは`packages/blocks`に配置しています。
`@workops/backend`はAmplify、`@workops/blocks`はBlocksとDBスキーマ・マイグレーションを管理するワークスペースです。
`amplify/backend.ts`でユーザープールとドメインを作り、`@workops/blocks/cdk`を接続して、ユーザープールID・リージョン・ドメイン・DB接続情報を出力します。
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

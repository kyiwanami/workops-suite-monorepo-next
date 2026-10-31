# workops-suite-monorepo-next

Amplify Gen 2の共有バックエンドを管理するnpm workspacesのモノレポです。
`packages/backend/amplify`にメール認証を定義しています。Node.js 24を使用します。

```powershell
npm ci
npm run lint
npm run typecheck
```

サンドボックスはリポジトリルートで実行します。AWSリソースを作成・更新します。

```powershell
$env:AWS_REGION = 'ap-northeast-1'
npm run sandbox -- --profile amazon-connect --identifier workops-next --once
```

接続設定は`packages/backend/amplify_outputs.json`に自動生成されます。
このファイルは手動編集せず、Git管理から除外します。

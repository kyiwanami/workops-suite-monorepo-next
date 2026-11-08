import { BlocksBackend, BlocksPresets } from '@aws-blocks/blocks/cdk';
import { CustomResource, Stack } from 'aws-cdk-lib';
import { Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { DatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { Provider } from 'aws-cdk-lib/custom-resources';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Amplifyから渡されたスタックにBlocksのリソースを構築します。
export async function createBlocksBackend(root: Stack) {
  root.node.setContext('@aws-blocks/bb-data:encryptStorageByDefault', true);
  const data = await BlocksBackend.create(root, 'blocks', {
    backendHandlerPath: fileURLToPath(new URL('./index.handler.ts', import.meta.url)),
    backendCDKPath: fileURLToPath(new URL('./index.ts', import.meta.url)),
    defaults: BlocksPresets.sandbox,
  });

  const db = data.node.findAll().find(node => node instanceof DatabaseCluster);
  assert(db?.secret);
  const databaseName = 'workops';

  // デプロイ中にDrizzleのマイグレーションを適用するカスタムリソースです。
  // マイグレーションのフォルダはLambdaレイヤーとして同梱し、内容が変わるとレイヤーのARNが変わって適用し直します。
  const scope = Stack.of(db);
  const migrations = new LayerVersion(scope, 'Migrations', {
    code: Code.fromAsset(fileURLToPath(new URL('./migrations', import.meta.url))),
  });
  const entry = fileURLToPath(new URL('./migrate.handler.ts', import.meta.url));
  const onEvent = new NodejsFunction(scope, 'MigrateOnEvent', { entry, handler: 'onEvent', runtime: Runtime.NODEJS_24_X });
  const isComplete = new NodejsFunction(scope, 'MigrateIsComplete', {
    entry,
    handler: 'isComplete',
    runtime: Runtime.NODEJS_24_X,
    layers: [migrations],
    environment: { DATABASE_NAME: databaseName, SECRET_ARN: db.secret.secretArn, CLUSTER_ARN: db.clusterArn },
  });
  db.grantDataApiAccess(isComplete);
  const provider = new Provider(scope, 'MigrateProvider', { onEventHandler: onEvent, isCompleteHandler: isComplete });
  new CustomResource(scope, 'Migrate', {
    serviceToken: provider.serviceToken,
    properties: { migrations: migrations.layerVersionArn },
  });

  // Blocksが生成するDB接続先とSecretの参照を共有します。
  return { clusterArn: db.clusterArn, secretArn: db.secret.secretArn, databaseName };
}

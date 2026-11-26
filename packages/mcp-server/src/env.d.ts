// 業務MCPサーバーの環境変数です。AWS_REGION は Runtime が、ほかは Runtime を作るときに設定します。
declare namespace NodeJS {
  interface ProcessEnv {
    AWS_REGION: string;
    DATABASE_NAME: string;
    SECRET_ARN: string;
    CLUSTER_ARN: string;
    USER_POOL_ID: string;
  }
}

import { defineConfig } from 'drizzle-kit';

// スキーマ定義からマイグレーションを生成します。DBには接続しません。
// 出力先は、デプロイ時にDrizzleのマイグレーションで適用するフォルダです。
export default defineConfig({
  dialect: 'postgresql',
  schema: './schema.ts',
  out: './migrations',
});

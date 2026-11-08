import { createLambdaHandler } from '@aws-blocks/blocks/lambda-handler';

// Blocksの標準ハンドラーです。業務用APIメソッドは定義しません。
export const handler = createLambdaHandler(() => import('./index.js'));

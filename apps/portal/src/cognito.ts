import 'server-only';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import outputs from '@workops/backend-portal/outputs';

// 共有のユーザープールのユーザーを管理する Cognito のクライアントです。認証情報は AWS SDK の既定の取得順で得ます。
export const cognito = new CognitoIdentityProviderClient({ region: outputs.auth.aws_region });

// 共有のユーザープールの ID です。
export const userPoolId = outputs.auth.user_pool_id;

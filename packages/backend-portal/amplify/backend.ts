import { defineAppBackend } from '@workops/backend/app-backend';

// ポータルのバックエンドです。共有のユーザープールにポータルのアプリクライアントを作ります。
defineAppBackend({
  clientName: 'PortalClient',
  port: 3000,
  // 全体管理者のユーザー管理で、共有のユーザープールのユーザーを一覧・作成・有効化・無効化・削除します。
  cognitoActions: [
    'cognito-idp:ListUsers',
    'cognito-idp:AdminGetUser',
    'cognito-idp:AdminCreateUser',
    'cognito-idp:AdminEnableUser',
    'cognito-idp:AdminDisableUser',
    'cognito-idp:AdminDeleteUser',
  ],
});

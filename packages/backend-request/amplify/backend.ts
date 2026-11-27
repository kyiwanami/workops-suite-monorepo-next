import { defineAppBackend } from '@workops/backend/app-backend';

// 申請管理のバックエンドです。共有のユーザープールに申請管理のアプリクライアントを作ります。
defineAppBackend({
  clientName: 'RequestClient',
  port: 3002,
  // 申請者の名前を出すため、共有のユーザープールのユーザーを一覧します。
  cognitoActions: ['cognito-idp:ListUsers'],
});

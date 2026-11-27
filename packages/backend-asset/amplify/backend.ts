import { defineAppBackend } from '@workops/backend/app-backend';

// 資産カタログのバックエンドです。共有のユーザープールに資産カタログのアプリクライアントを作ります。
defineAppBackend({
  clientName: 'AssetClient',
  port: 3001,
  // 資産の担当者の名前を出すため、共有のユーザープールのユーザーを一覧します。
  cognitoActions: ['cognito-idp:ListUsers'],
});

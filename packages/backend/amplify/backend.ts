import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';

// 共有バックエンドの認証リソースを定義します。
defineBackend({ auth });

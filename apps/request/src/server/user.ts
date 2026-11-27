import 'server-only';
import { createUserQueries } from '@workops/server/user';
import { runWithAmplifyServerContext } from './auth';

// 申請管理でログイン中の利用者の所属・メールと、業務の処理を呼ぶときの接続と利用者を取得します。
export const { getMembership, getEmail, getMember, getContext } = createUserQueries(runWithAmplifyServerContext);

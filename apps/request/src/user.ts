import 'server-only';
import { createUserQueries } from '@workops/server/user';
import { runWithAmplifyServerContext } from './auth';

// 申請管理でログイン中の利用者のメールを取得します。
export const { getEmail } = createUserQueries(runWithAmplifyServerContext);

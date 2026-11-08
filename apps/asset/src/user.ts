import 'server-only';
import { createUserQueries } from '@workops/server/user';
import { runWithAmplifyServerContext } from './auth';

// 資産カタログでログイン中の利用者のメールを取得します。
export const { getEmail } = createUserQueries(runWithAmplifyServerContext);

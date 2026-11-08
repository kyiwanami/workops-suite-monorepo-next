import 'server-only';
import { createUserQueries } from '@workops/server/user';
import { runWithAmplifyServerContext } from './auth';

// ポータルでログイン中の利用者の所属とメールを取得します。
export const { getMembership, getEmail } = createUserQueries(runWithAmplifyServerContext);

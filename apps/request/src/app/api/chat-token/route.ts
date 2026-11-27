import { createChatTokenRoute } from '@workops/server/chat';
import { runWithAmplifyServerContext } from '@/server/auth';

// AIのパネルがチャットのAPIを呼ぶための、ログイン中の利用者のアクセストークンを返します。
export const GET = createChatTokenRoute(runWithAmplifyServerContext);

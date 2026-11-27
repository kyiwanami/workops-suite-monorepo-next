import 'server-only';
import outputs from '@workops/backend/outputs';

// チャットのAPIのURLです。Amplifyの出力から読み、画面のレイアウトからAIのパネルに渡します。
// 出力にはDBの接続先も入っているため、ブラウザでは読み込みません。
export const chatApiUrl = outputs.custom.chatApiUrl;

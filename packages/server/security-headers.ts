import { defaults, nosecone } from '@nosecone/next';
import type { HostSource } from 'nosecone';

// CSP の接続先に書けるオリジンかを確かめます。設定から読む URL を、Nosecone のホストの書き方の型にします。
function isHostSource(value: string): value is HostSource {
  return URL.canParse(value);
}

// 画面の応答に付けるセキュリティヘッダーを作ります。値は Nosecone の既定値で、CSP には要求ごとの nonce が入ります。
// connectOrigins は、画面から呼ぶほかのオリジン（チャットのAPI）です。CSP の接続先に足します。
export function createSecurityHeaders(connectOrigins: string[]) {
  return nosecone({
    ...defaults,
    contentSecurityPolicy: {
      directives: {
        ...defaults.contentSecurityPolicy.directives,
        connectSrc: [...defaults.contentSecurityPolicy.directives.connectSrc, ...connectOrigins.filter(isHostSource)],
      },
    },
  });
}

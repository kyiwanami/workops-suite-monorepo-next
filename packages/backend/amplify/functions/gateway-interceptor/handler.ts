import { env } from '$amplify/env/gateway-interceptor';
import type { JSONRPCRequest } from '@modelcontextprotocol/server';
import type { Handler } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Gateway から渡される要求です。ヘッダーはインターセプターの設定でヘッダーを渡すときだけ入ります。
type InterceptorEvent = { mcp: { gatewayRequest: { headers?: Record<string, string>; body: JSONRPCRequest } } };

// ユーザープールが発行したアクセストークンかを検証し、利用者を取り出します。受け付けるクライアントは Gateway が判定します。
// 鍵は Lambda の実行環境の中で使い回します。
const verifier = CognitoJwtVerifier.create({
  userPoolId: env.USER_POOL_ID,
  tokenUse: 'access',
  clientId: null,
});

// ツールを呼んだ利用者を、要求の `_meta` に入れます。クライアントが送った値は必ずトークンの利用者で上書きします。
// 利用者が分からない要求は、業務MCPサーバーへ通さずに断ります。同じ入力には同じ出力を返します。
export const handler: Handler<InterceptorEvent> = async (event) => {
  const { headers, body } = event.mcp.gatewayRequest;
  const requestHeaders = new Headers(headers);
  const token = requestHeaders.get('authorization')?.replace(/^Bearer /i, '');
  const claims = token === undefined ? undefined : await verifier.verify(token).catch(() => undefined);
  console.log(
    JSON.stringify({
      method: body.method,
      tool: body.params?.name,
      sub: claims?.sub,
      clientId: claims?.client_id,
      traceparent: requestHeaders.get('traceparent'),
    }),
  );
  if (claims === undefined) {
    return {
      interceptorOutputVersion: '1.0',
      mcp: {
        transformedGatewayResponse: {
          statusCode: 401,
          body: { jsonrpc: '2.0', id: body.id, error: { code: -32600, message: '利用者を確認できませんでした。' } },
        },
      },
    };
  }
  const transformed =
    body.method === 'tools/call'
      ? { ...body, params: { ...body.params, _meta: { ...body.params?._meta, 'workops/userSub': claims.sub } } }
      : body;
  return { interceptorOutputVersion: '1.0', mcp: { transformedGatewayRequest: { body: transformed } } };
};

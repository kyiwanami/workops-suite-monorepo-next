import { env } from '$amplify/env/chat';
import {
  BedrockAgentCoreClient,
  GetResourceOauth2TokenCommand,
  GetWorkloadAccessTokenForJWTCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';

const agentCore = new BedrockAgentCoreClient({ region: env.AWS_REGION });

// 利用者のトークンを、交換用のクライアントのトークンに交換します。利用者になりすます形で交換します。
// Harness と Gateway は、このクライアントのトークンだけを受け付けます。画面はこのクライアントのシークレットを持たないため、Harness を直接呼べません。
export async function exchangeToken(userToken: string) {
  const { workloadAccessToken } = await agentCore.send(
    new GetWorkloadAccessTokenForJWTCommand({ workloadName: env.WORKLOAD_NAME, userToken }),
  );
  const { accessToken } = await agentCore.send(
    new GetResourceOauth2TokenCommand({
      workloadIdentityToken: workloadAccessToken,
      resourceCredentialProviderName: env.CREDENTIAL_PROVIDER_NAME,
      scopes: ['workops/chat'],
      oauth2Flow: 'ON_BEHALF_OF_TOKEN_EXCHANGE',
      customParameters: { subject_token_type: 'urn:ietf:params:oauth:token-type:access_token' },
    }),
  );
  // 交換できなければ失敗
  if (accessToken === undefined) {
    throw new Error('トークンを交換できませんでした。');
  }
  return accessToken;
}

// Gateway のツールの公開名の接頭辞です。Gateway は、ターゲット名と「___」をツール名の前に付けます。
// 書込みのツールは、Gateway のツールと名前が重ならないように、接頭辞を外した名前で Harness に渡します。
const gatewayPrefix = 'workops___';

// 交換したトークンで、利用者として Gateway に接続した MCP のクライアントを返します。呼び出し元が使い終わったら閉じます。
// Gateway は MCP の初期化（initialize）で接続するため、プロトコルの版の問い合わせをしません。
export function connectGateway(token: string) {
  return createMCPClient({
    transport: { type: 'http', url: env.GATEWAY_URL, headers: { Authorization: `Bearer ${token}` }, redirect: 'error' },
    protocolVersionDiscovery: false,
  });
}

// 利用者のロールで呼べる Gateway のツールを、AI SDK のツールにします。表示名と MCP の注釈は AI SDK のツールが持ちます。
// 読み取りのツール（readOnlyHint が true）は Harness が実行するため、その名前も返します。
// それ以外は書込みのツールとして、確認カードを経て AI SDK が実行します。Harness に渡す名前で引けるように、接頭辞を外します。
export async function listGatewayTools(gateway: MCPClient) {
  const definitions = await gateway.listTools();
  const readTools = definitions.tools.filter((tool) => tool.annotations?.readOnlyHint === true).map((tool) => tool.name);
  const read = new Set(readTools);
  const tools = Object.fromEntries(
    // 読み取りのツールは Gateway の名前のまま、書込みのツールは接頭辞を外す
    Object.entries(gateway.toolsFromDefinitions(definitions)).map(([name, tool]) => [read.has(name) ? name : name.slice(gatewayPrefix.length), tool]),
  );
  return { readTools, tools };
}

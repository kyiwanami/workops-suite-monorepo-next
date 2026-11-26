// メタデータ文書の URL を ID として名乗り、業務のツールを使える MCP クライアントです。
// 提供元ごとに CIMD ポリシーを1つ作ります。1つのポリシーに登録できる URL は5個まで、ポリシーは10個までです。
// callbackUrls は、提供元のクライアントが外部のMCPクライアント用のクライアントの ID で接続するときの戻り先です。
export const mcpClientProviders = [
  {
    name: 'anthropic',
    urls: [
      // Claude Code
      'https://claude.ai/oauth/claude-code-client-metadata',
      // Claude（Web・デスクトップ・モバイル）
      'https://claude.ai/oauth/mcp-oauth-client-metadata',
    ],
    // Claude（Web・デスクトップ・モバイル）
    callbackUrls: ['https://claude.ai/api/mcp/auth_callback'],
  },
  {
    name: 'openai',
    urls: [
      // Codex
      'https://chatgpt.com/oauth/codex/client.json',
      // ChatGPT（コールバックごとの URL と、共通の URL）
      'https://chatgpt.com/oauth/*/client.json',
      'https://chatgpt.com/oauth/client.json',
    ],
    callbackUrls: [],
  },
];

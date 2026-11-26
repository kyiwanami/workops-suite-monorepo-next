import { serve } from '@hono/node-server';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { createServer } from './tools';

// MCP の要求を、要求ごとに作るサーバーで処理します。セッションを持たず、結果は JSON で返します。
const mcp = createMcpHandler(createServer, { responseMode: 'json' });

// Runtime の決まりに合わせ、`/mcp` で MCP を受け、`GET /ping` で稼働中を返します。
const app = new Hono();
app.get('/ping', (c) => c.json({ status: 'Healthy' }));
app.all('/mcp', (c) => mcp.fetch(c.req.raw));
serve({ fetch: app.fetch, hostname: '0.0.0.0', port: 8000 });

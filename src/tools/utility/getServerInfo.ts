import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_NAME, SERVER_VERSION } from '../../mcp/server.js';
import { structuredResult } from '../../mcp/output.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerGetServerInfo(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'swsd_get_server_info',
    {
      description:
        "Return the SWSD MCP server's name, version, configured profile, " +
        'enabled tools, and the SWSD base URL host. Local-only — does not call SWSD.' +
        ' Includes documented SWSD upstream rate limits (the model can reference these without guessing).',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
    },
    () => {
      const baseUrlHost = safeUrlHost(ctx.env.SWSD_BASE_URL);
      const data = {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        profile: ctx.profile,
        tools: [...ctx.enabledTools].sort(),
        base_url_host: baseUrlHost,
        api_version: ctx.env.SWSD_API_VERSION,
        upstream_rate_limit: {
          advanced_plan: '1000 calls/min (account-wide)',
          premier_plan: '1500 calls/min (account-wide)',
          signal: '429 + Retry-After only — SWSD does not return X-RateLimit-* headers',
          client_behavior: `auto-retry with exponential backoff (max attempts: ${String(ctx.env.SWSD_RETRY_MAX_ATTEMPTS)})`,
        },
      };
      const summary = `${SERVER_NAME} v${SERVER_VERSION} | profile=${ctx.profile} | host=${baseUrlHost} | tools=${String(data.tools.length)}`;
      return structuredResult(data, summary);
    },
  );
}

function safeUrlHost(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return raw;
  }
}

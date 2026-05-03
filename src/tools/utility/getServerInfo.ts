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
        'enabled tools, and the SWSD base URL host. Local-only — does not call SWSD.',
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

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, ProfileName } from './env.js';
import { PROFILE_TOOLS } from './profiles.js';
import type { SwsdClient } from '../swsd/client.js';
import { registerGetServerInfo } from '../tools/utility/getServerInfo.js';
import { registerHealthCheck } from '../tools/utility/healthCheck.js';
import { registerListIncidents } from '../tools/incidents/listIncidents.js';
import { registerGetIncident } from '../tools/incidents/getIncident.js';

export interface ToolContext {
  env: Env;
  profile: ProfileName;
  client: SwsdClient;
  enabledTools: string[];
}

type Registrar = (server: McpServer, ctx: ToolContext) => void;

const REGISTRARS: Record<string, Registrar> = {
  swsd_get_server_info: registerGetServerInfo,
  swsd_health_check: registerHealthCheck,
  swsd_list_incidents: registerListIncidents,
  swsd_get_incident: registerGetIncident,
};

export function registerTools(server: McpServer, ctx: ToolContext): void {
  for (const t of ctx.env.SWSD_ENABLE_EXTRAS) {
    if (!(t in REGISTRARS)) {
      const known = Object.keys(REGISTRARS).sort().join(', ');
      throw new Error(
        `Unknown tool in SWSD_ENABLE_EXTRAS: "${t}". Known tools: ${known}`,
      );
    }
  }

  const profileTools = PROFILE_TOOLS[ctx.profile];
  const all = new Set<string>([...profileTools, ...ctx.env.SWSD_ENABLE_EXTRAS]);

  for (const tool of all) {
    const register = REGISTRARS[tool];
    if (!register) continue;
    register(server, ctx);
    ctx.enabledTools.push(tool);
  }
}

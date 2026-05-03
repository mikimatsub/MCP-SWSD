import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, ProfileName } from './env.js';
import { PROFILE_TOOLS } from './profiles.js';
import type { SwsdClient } from '../swsd/client.js';

import { registerGetServerInfo } from '../tools/utility/getServerInfo.js';
import { registerHealthCheck } from '../tools/utility/healthCheck.js';

import { registerListIncidents } from '../tools/incidents/listIncidents.js';
import { registerGetIncident } from '../tools/incidents/getIncident.js';
import { registerCreateIncident } from '../tools/incidents/createIncident.js';
import { registerUpdateIncident } from '../tools/incidents/updateIncident.js';
import { registerAssignIncident } from '../tools/incidents/assignIncident.js';
import { registerUpdateIncidentState } from '../tools/incidents/updateIncidentState.js';
import { registerLinkSolutionToIncident } from '../tools/incidents/linkSolutionToIncident.js';

import { registerListIncidentComments } from '../tools/comments/listIncidentComments.js';
import { registerAddIncidentComment } from '../tools/comments/addIncidentComment.js';
import { registerUpdateComment } from '../tools/comments/updateComment.js';

import { registerListCategories } from '../tools/lookups/listCategories.js';
import { registerListSites } from '../tools/lookups/listSites.js';
import { registerListDepartments } from '../tools/lookups/listDepartments.js';
import { registerListUsers } from '../tools/lookups/listUsers.js';
import { registerListGroups } from '../tools/lookups/listGroups.js';
import { registerListRoles } from '../tools/lookups/listRoles.js';

import { registerSearchSolutions } from '../tools/solutions/searchSolutions.js';
import { registerGetSolution } from '../tools/solutions/getSolution.js';
import { registerCreateSolution } from '../tools/solutions/createSolution.js';
import { registerUpdateSolution } from '../tools/solutions/updateSolution.js';

import { registerDescribeCustomFields } from '../tools/customFields/describeCustomFields.js';

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
  swsd_create_incident: registerCreateIncident,
  swsd_update_incident: registerUpdateIncident,
  swsd_assign_incident: registerAssignIncident,
  swsd_update_incident_state: registerUpdateIncidentState,
  swsd_link_solution_to_incident: registerLinkSolutionToIncident,

  swsd_list_incident_comments: registerListIncidentComments,
  swsd_add_incident_comment: registerAddIncidentComment,
  swsd_update_comment: registerUpdateComment,

  swsd_list_categories: registerListCategories,
  swsd_list_sites: registerListSites,
  swsd_list_departments: registerListDepartments,
  swsd_list_users: registerListUsers,
  swsd_list_groups: registerListGroups,
  swsd_list_roles: registerListRoles,

  swsd_search_solutions: registerSearchSolutions,
  swsd_get_solution: registerGetSolution,
  swsd_create_solution: registerCreateSolution,
  swsd_update_solution: registerUpdateSolution,

  swsd_describe_custom_fields: registerDescribeCustomFields,
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

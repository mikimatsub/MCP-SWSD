import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AssignIncidentInput } from '../../schemas/incident.js';
import { structuredResult } from '../../mcp/output.js';
import { toolError } from '../../mcp/errors.js';
import { mapSwsdError } from '../../swsd/errors.js';
import {
  buildIncidentWritePayload,
  toIncidentDetail,
} from '../../swsd/mappers/incident.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerAssignIncident(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'swsd_assign_incident',
    {
      description:
        'Assign an SWSD incident to an agent by email. Safer wrapper around swsd_update_incident — ' +
        'narrows the agent decision surface to "who gets this ticket." Use swsd_list_users with ' +
        'available_for_assignment_only=true to find valid assignees first. ' +
        'WRITE — does not retry on transient failure.',
      inputSchema: AssignIncidentInput.shape,
      annotations: { readOnlyHint: false, openWorldHint: true, idempotentHint: false },
    },
    async ({ id, assignee_email }) => {
      try {
        const payload = buildIncidentWritePayload({ assignee_email });
        const { body } = await ctx.client.put<unknown>(`/incidents/${String(id)}.json`, payload);
        const incident = toIncidentDetail(body);
        if (!incident) {
          return toolError('Could not parse assignment response from SWSD.');
        }
        return structuredResult(
          { incident },
          `Assigned incident ${String(id)} to ${assignee_email}.`,
        );
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );
}

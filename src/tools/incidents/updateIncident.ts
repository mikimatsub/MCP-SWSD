import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { UpdateIncidentInput } from '../../schemas/incident.js';
import { structuredResult } from '../../mcp/output.js';
import { toolError } from '../../mcp/errors.js';
import { mapSwsdError } from '../../swsd/errors.js';
import {
  buildIncidentWritePayload,
  toIncidentDetail,
} from '../../swsd/mappers/incident.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerUpdateIncident(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'swsd_update_incident',
    {
      description:
        'Update an existing SWSD incident. Pass `id` and any fields to change. Only fields ' +
        'you provide are sent — others stay as-is. For state transitions prefer swsd_update_incident_state ' +
        '(safer wrapper); for assignment prefer swsd_assign_incident; for comments use swsd_add_incident_comment. ' +
        'WRITE — does not retry on transient failure.',
      inputSchema: UpdateIncidentInput.shape,
      annotations: { readOnlyHint: false, openWorldHint: true, idempotentHint: false },
    },
    async (input) => {
      try {
        const { id, ...fields } = input;
        const payload = buildIncidentWritePayload(fields);
        if (Object.keys(payload.incident).length === 0) {
          return toolError(
            'No fields to update — provide at least one field besides id.',
            'Pass any of: name, description, priority, category_name, site_name, department_name.',
          );
        }
        const { body } = await ctx.client.put<unknown>(`/incidents/${String(id)}.json`, payload);
        const incident = toIncidentDetail(body);
        if (!incident) {
          return toolError('Could not parse updated-incident response from SWSD.');
        }
        const changed = Object.keys(payload.incident);
        return structuredResult(
          { incident, changed_fields: changed },
          `Updated incident ${String(id)} (${changed.join(', ')}).`,
        );
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );
}

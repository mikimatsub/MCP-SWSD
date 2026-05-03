import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListIncidentsInput } from '../../schemas/incident.js';
import { structuredResult } from '../../mcp/output.js';
import { mapSwsdError } from '../../swsd/errors.js';
import { toIncidentSummary } from '../../swsd/mappers/incident.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerListIncidents(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'swsd_list_incidents',
    {
      description:
        'List SWSD incidents with structured filters and pagination. Returns ' +
        'compact summaries (id, name, state, priority, assignee_email, requester_email, ' +
        'category, updated_at) — call swsd_get_incident for the full detail of any one row. ' +
        'Filters use SWSD repeated-key array semantics (multiple values within a filter are OR-ed).',
      inputSchema: ListIncidentsInput.shape,
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async (input) => {
      try {
        const params: Record<string, unknown> = {
          page: input.page,
          per_page: input.per_page,
        };
        if (input.states) params.state = input.states;
        if (input.priorities) params.priority = input.priorities;
        if (input.categories) params.category = input.categories;
        if (input.assignee_email) params.assignee_email = input.assignee_email;
        if (input.requester_email) params.requester_email = input.requester_email;
        if (input.updated_from) params.updated_at = ['greater_than', input.updated_from];

        const { body, pagination } = await ctx.client.get<unknown>('/incidents.json', params);
        const raw = Array.isArray(body) ? body : [];
        const incidents = raw
          .map(toIncidentSummary)
          .filter((x): x is NonNullable<typeof x> => x !== null);

        const data = { incidents, pagination };
        const totalNote =
          pagination.total !== undefined ? ` of ~${String(pagination.total)}` : '';
        const moreNote = pagination.has_more ? ', more available' : '';
        const summary = `Returned ${String(incidents.length)} incidents (page ${String(pagination.page)}${totalNote}${moreNote}).`;
        return structuredResult(data, summary);
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );
}

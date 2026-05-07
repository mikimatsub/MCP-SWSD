import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ListIncidentsInput } from '../../schemas/incident.js';
import { PaginationOutput } from '../../schemas/output.js';
import { structuredResult } from '../../mcp/output.js';
import { mapSwsdError } from '../../swsd/errors.js';
import { toIncidentSummary } from '../../swsd/mappers/incident.js';
import type { ToolContext } from '../../config/toolRegistry.js';

const IncidentSummaryOutput = z.object({
  id: z.number().int(),
  number: z.number().int().optional(),
  name: z.string(),
  state: z.string().optional(),
  priority: z.string().optional(),
  assignee_email: z.string().optional(),
  requester_email: z.string().optional(),
  category: z.string().optional(),
  updated_at: z.string().optional(),
  url: z
    .string()
    .optional()
    .describe('SWSD UI URL for this incident (from href_account_domain).'),
});

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
      outputSchema: z.object({
        incidents: z.array(IncidentSummaryOutput),
        pagination: PaginationOutput,
      }).shape,
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
        if (input.updated_to) params.updated_to = input.updated_to;
        if (input.created_from) params.created_from = input.created_from;
        if (input.created_to) params.created_to = input.created_to;
        if (input.sites) params.site = input.sites;
        if (input.departments) params.department = input.departments;
        if (input.assigned_to_group !== undefined) params.assigned_to = input.assigned_to_group;
        if (input.state_is_not) params.state_is_not = input.state_is_not;
        if (input.sort_by) params.sort_by = input.sort_by;
        if (input.sort_order) params.sort_order = input.sort_order;
        if (input.query) params.query = input.query;

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

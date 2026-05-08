import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { ListIncidentsInput } from '../../schemas/incident.js';
import { PaginationWithScopeOutput } from '../../schemas/output.js';
import { structuredResult } from '../../mcp/output.js';
import { mapSwsdError } from '../../swsd/errors.js';
import { toIncidentSummary } from '../../swsd/mappers/incident.js';
import { loadUiResource } from '../../mcp/uiResources.js';
import { applyDateAlias } from '../../utils/dateAliases.js';
import type { ToolContext } from '../../config/toolRegistry.js';

const UI_RESOURCE_URI = 'ui://swsd/incident-list.html';

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
  registerAppTool(
    server,
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
        pagination: PaginationWithScopeOutput,
        applied_filters: z
          .record(z.string(), z.unknown())
          .describe(
            'Echo of the filters applied to this query — empty object if none. Use this to reason about whether the result count reflects your filters or the tenant total.',
          ),
      }).shape,
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
      _meta: { ui: { resourceUri: UI_RESOURCE_URI } },
    },
    async (rawInput) => {
      try {
        // Translate `updated_within` (e.g. "7d", "24h") into a concrete
        // `updated_from` ISO date before assembling params. Explicit
        // `updated_from` always wins; the alias is dropped after translation.
        const input = applyDateAlias(rawInput);
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

        // Echo the applied filters back for in-band scope reasoning.
        const applied_filters: Record<string, unknown> = {};
        if (input.states) applied_filters.states = input.states;
        if (input.priorities) applied_filters.priorities = input.priorities;
        if (input.categories) applied_filters.categories = input.categories;
        if (input.assignee_email) applied_filters.assignee_email = input.assignee_email;
        if (input.requester_email) applied_filters.requester_email = input.requester_email;
        if (input.updated_from) applied_filters.updated_from = input.updated_from;
        if (input.updated_to) applied_filters.updated_to = input.updated_to;
        if (input.created_from) applied_filters.created_from = input.created_from;
        if (input.created_to) applied_filters.created_to = input.created_to;
        if (input.sites) applied_filters.sites = input.sites;
        if (input.departments) applied_filters.departments = input.departments;
        if (input.assigned_to_group !== undefined) applied_filters.assigned_to_group = input.assigned_to_group;
        if (input.state_is_not) applied_filters.state_is_not = input.state_is_not;
        if (input.sort_by) applied_filters.sort_by = input.sort_by;
        if (input.sort_order) applied_filters.sort_order = input.sort_order;
        if (input.query) applied_filters.query = input.query;

        const hasAnyFilter = Object.keys(applied_filters).length > 0;
        const total_scope: 'filtered' | 'tenant' | 'unknown' =
          pagination.total === undefined
            ? 'unknown'
            : hasAnyFilter
              ? 'filtered'
              : 'tenant';

        const filterDescription = hasAnyFilter
          ? `matching your filters (${Object.entries(applied_filters)
              .slice(0, 3)
              .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : String(v)}`)
              .join(', ')}${Object.keys(applied_filters).length > 3 ? ', ...' : ''})`
          : 'tenant-wide';
        const totalNote =
          pagination.total !== undefined ? ` of ${String(pagination.total)}` : '';
        const moreNote = pagination.has_more ? ', more available' : '';
        const summary = `Returned ${String(incidents.length)}${totalNote} ${filterDescription} incidents (page ${String(pagination.page)}${moreNote}).`;

        return structuredResult(
          {
            incidents,
            pagination: { ...pagination, total_scope },
            applied_filters,
          },
          summary,
        );
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );

  registerAppResource(
    server,
    'swsd-incident-list-ui',
    UI_RESOURCE_URI,
    { description: 'Incident list view rendered by Apps-capable hosts.' },
    () => ({
      contents: [
        {
          uri: UI_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: loadUiResource('incident-list'),
        },
      ],
    }),
  );
}

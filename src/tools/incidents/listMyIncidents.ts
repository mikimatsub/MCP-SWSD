import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListMyIncidentsInput } from '../../schemas/listMyIncidents.js';
import { structuredResult } from '../../mcp/output.js';
import { toolError } from '../../mcp/errors.js';
import { mapSwsdError } from '../../swsd/errors.js';
import { toIncidentSummary } from '../../swsd/mappers/incident.js';
import { decodeJwtPayload } from '../../swsd/jwt.js';
import { toUserMeRecord } from '../../swsd/mappers/me.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerListMyIncidents(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'swsd_list_my_incidents',
    {
      description:
        'List incidents assigned to the authenticated user. Internally calls ' +
        'swsd_get_me to discover the user\'s email, then swsd_list_incidents ' +
        'with assignee_email=<your email>. Use this for first-person queries ' +
        '("my tickets", "tickets assigned to me"). Same input shape as ' +
        'swsd_list_incidents minus assignee_email (which is set automatically). ' +
        'For tenant-wide queries use swsd_list_incidents with explicit filters.',
      inputSchema: ListMyIncidentsInput.shape,
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async (input) => {
      try {
        // Step 1: Resolve the authenticated user's email via JWT + /users/{id}.
        const claims = decodeJwtPayload(ctx.token);
        if (claims === null || typeof claims.user_ic !== 'number') {
          return toolError('Could not decode SWSD JWT to identify the authenticated user.');
        }
        const usersResult = await ctx.client.get<unknown>(`/users/${String(claims.user_ic)}.json`);
        const me = toUserMeRecord(usersResult.body);
        if (me === null || me.email === undefined) {
          return toolError(`Could not resolve email for user_ic ${String(claims.user_ic)}.`);
        }

        // Step 2: Build /incidents.json query with assignee_email = me.email + the input filters.
        const params: Record<string, unknown> = {
          page: input.page,
          per_page: input.per_page,
          assignee_email: me.email,
        };
        if (input.states) params.state = input.states;
        if (input.priorities) params.priority = input.priorities;
        if (input.categories) params.category = input.categories;
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

        const totalNote =
          pagination.total !== undefined ? ` of ${String(pagination.total)}` : '';
        const moreNote = pagination.has_more ? ', more available' : '';
        const summary =
          `Returned ${String(incidents.length)} incidents${totalNote} assigned to ${me.email} ` +
          `(page ${String(pagination.page)}${moreNote}).`;
        return structuredResult({ incidents, pagination, assignee_email: me.email }, summary);
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );
}

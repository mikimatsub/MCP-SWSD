import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DescribeCustomFieldsInput } from '../../schemas/customField.js';
import { structuredResult } from '../../mcp/output.js';
import { mapSwsdError } from '../../swsd/errors.js';
import { toCustomFieldSummary } from '../../swsd/mappers/customField.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerDescribeCustomFields(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    'swsd_describe_custom_fields',
    {
      description:
        "List the SWSD tenant's custom-field schema. Returns id, name, type " +
        '(e.g. "Text", "Dropdown", "Date"), required, scope, module, allowed ' +
        '`values` for dropdown fields, and help_text. Use this BEFORE calling ' +
        'swsd_create_incident / swsd_update_incident / swsd_create_solution / ' +
        'swsd_update_solution with custom_fields_values to validate field names ' +
        'and dropdown values. Default returns active fields only — pass ' +
        '`active_only: false` to see retired ones too. Filter by `scope` or ' +
        '`module` to narrow the surface (the tenant may have 100+ fields).',
      inputSchema: DescribeCustomFieldsInput.shape,
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async (input) => {
      try {
        // Note: SWSD's /custom_fields.json silently ignores per_page and
        // returns the entire collection. We fetch once and apply filtering +
        // pagination client-side so the agent's per_page is honored.
        const { body } = await ctx.client.get<unknown>('/custom_fields.json', {
          per_page: 1,
        });
        const arr = Array.isArray(body) ? body : [];
        const allFields = arr
          .map(toCustomFieldSummary)
          .filter((f): f is NonNullable<typeof f> => f !== null);

        let filtered = allFields;
        if (input.active_only) filtered = filtered.filter((f) => f.active);
        if (input.scope) filtered = filtered.filter((f) => f.scope === input.scope);
        if (input.module) filtered = filtered.filter((f) => f.module === input.module);

        const total = filtered.length;
        const startIdx = (input.page - 1) * input.per_page;
        const pageItems = filtered.slice(startIdx, startIdx + input.per_page);
        const has_more = startIdx + input.per_page < total;

        const filterNotes: string[] = [];
        if (input.active_only) filterNotes.push('active');
        if (input.scope) filterNotes.push(`scope=${input.scope}`);
        if (input.module) filterNotes.push(`module=${input.module}`);
        const note = filterNotes.length > 0 ? ` filtered to ${filterNotes.join(', ')}` : '';

        return structuredResult(
          {
            custom_fields: pageItems,
            pagination: {
              page: input.page,
              per_page: input.per_page,
              total,
              has_more,
              next_page: has_more ? input.page + 1 : undefined,
            },
          },
          `Returned ${String(pageItems.length)} of ${String(total)} custom fields ` +
            `(page ${String(input.page)}${has_more ? ', more available' : ''}${note}).`,
        );
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );
}

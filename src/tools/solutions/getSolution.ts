import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetSolutionInput } from '../../schemas/solution.js';
import { structuredResult } from '../../mcp/output.js';
import { toolError } from '../../mcp/errors.js';
import { mapSwsdError } from '../../swsd/errors.js';
import { toSolutionDetail } from '../../swsd/mappers/solution.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerGetSolution(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'swsd_get_solution',
    {
      description:
        'Fetch one SWSD solution by numeric ID. Returns the full solution as ' +
        'returned by SWSD (passthrough), including both `description` (HTML) and ' +
        '`description_no_html` (plain text) fields, custom_fields_values, comments ' +
        'count, and attachment metadata. Use swsd_search_solutions first if you ' +
        'only have a topic — IDs are not guessable.' +
        ' Pass detail_level: "long" to include attachments, audits, and tags in one call.',
      inputSchema: GetSolutionInput.shape,
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async (input) => {
      try {
        const params = input.detail_level === 'long' ? { layout: 'long' } : {};
        const { body } = await ctx.client.get<unknown>(
          `/solutions/${String(input.id)}.json`,
          params,
        );
        const solution = toSolutionDetail(body);
        if (!solution) {
          return toolError(
            `Could not parse solution ${String(input.id)} response from SWSD.`,
            'The response was not a JSON object with a numeric id field. Verify the solution exists with swsd_search_solutions.',
          );
        }
        const name = typeof solution.name === 'string' ? `: ${solution.name}` : '';
        return structuredResult({ solution }, `Solution ${String(solution.id)}${name}`);
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );
}

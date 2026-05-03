import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CreateSolutionInput } from '../../schemas/solution.js';
import { structuredResult } from '../../mcp/output.js';
import { toolError } from '../../mcp/errors.js';
import { mapSwsdError } from '../../swsd/errors.js';
import {
  buildSolutionWritePayload,
  toSolutionDetail,
} from '../../swsd/mappers/solution.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerCreateSolution(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'swsd_create_solution',
    {
      description:
        'Create a new SWSD knowledge-base solution article. Required: `name` (title). ' +
        'Strongly recommended: `description` (article body — HTML supported), `state` ' +
        '(common values: "Internal", "Published", "Draft" — tenant-specific). ' +
        'Returns the created solution\'s ID for follow-up calls. ' +
        'WRITE — does not retry on transient failure; verify with swsd_get_solution before retrying.',
      inputSchema: CreateSolutionInput.shape,
      annotations: { readOnlyHint: false, openWorldHint: true, idempotentHint: false },
    },
    async (input) => {
      try {
        const payload = buildSolutionWritePayload(input);
        const { body } = await ctx.client.post<unknown>('/solutions.json', payload);
        const solution = toSolutionDetail(body);
        if (!solution) {
          return toolError('Could not parse created-solution response from SWSD.');
        }
        const name = typeof solution.name === 'string' ? solution.name : '(no name)';
        return structuredResult(
          { solution },
          `Created solution ${String(solution.id)}: ${name}`,
        );
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );
}

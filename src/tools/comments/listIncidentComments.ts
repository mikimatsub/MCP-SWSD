import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListIncidentCommentsInput } from '../../schemas/comment.js';
import { structuredResult } from '../../mcp/output.js';
import { mapSwsdError } from '../../swsd/errors.js';
import { toCommentSummary } from '../../swsd/mappers/comment.js';
import { fetchAndMap } from '../../swsd/list-helper.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerListIncidentComments(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'swsd_list_incident_comments',
    {
      description:
        'List comments on a SWSD incident. Returns id, body, is_private, author_email, ' +
        'author_name, created_at. Use swsd_add_incident_comment to add a new comment.',
      inputSchema: ListIncidentCommentsInput.shape,
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async ({ incident_id, page, per_page }) => {
      try {
        const { items, pagination } = await fetchAndMap(
          ctx.client,
          `/incidents/${String(incident_id)}/comments.json`,
          toCommentSummary,
          { page, per_page },
        );
        return structuredResult(
          { comments: items, pagination },
          `Returned ${String(items.length)} comments on incident ${String(incident_id)} (page ${String(pagination.page)}${pagination.has_more ? ', more available' : ''}).`,
        );
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );
}

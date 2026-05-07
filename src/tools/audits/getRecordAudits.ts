import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetRecordAuditsInput } from '../../schemas/audit.js';
import { structuredResult } from '../../mcp/output.js';
import { mapSwsdError } from '../../swsd/errors.js';
import { toAuditSummary } from '../../swsd/mappers/audit.js';
import type { ToolContext } from '../../config/toolRegistry.js';

export function registerGetRecordAudits(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'swsd_get_record_audits',
    {
      description:
        'List the audit log for a SWSD record. Each audit entry captures one ' +
        'change: action ("Update"/"Create"/"Delete"), message ("State changed ' +
        'from New to Assigned"), the user who performed it, and the timestamp. ' +
        'Use this to answer "who changed this ticket?" or "what happened since ' +
        "I last looked?\". Cheaper than swsd_get_incident with detail_level=long " +
        'when you only need the audit history. object_type accepts incidents, ' +
        'problems, changes, releases, solutions, hardwares, other_assets.',
      inputSchema: GetRecordAuditsInput.shape,
      annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
    },
    async (input) => {
      try {
        const params: Record<string, unknown> = {
          page: input.page,
          per_page: input.per_page,
        };
        const path = `/${input.object_type}/${String(input.id)}/audits.json`;
        const { body, pagination } = await ctx.client.get<unknown>(path, params);
        const raw = Array.isArray(body) ? body : [];
        const audits = raw
          .map(toAuditSummary)
          .filter((a): a is NonNullable<typeof a> => a !== null);

        const totalNote =
          pagination.total !== undefined ? ` of ${String(pagination.total)}` : '';
        const moreNote = pagination.has_more ? ', more available' : '';
        const summary = `Returned ${String(audits.length)} audits${totalNote} for ${input.object_type}/${String(input.id)} (page ${String(pagination.page)}${moreNote}).`;
        return structuredResult({ audits, pagination }, summary);
      } catch (err) {
        return mapSwsdError(err);
      }
    },
  );
}

import { z } from 'zod';

export const GetRecordAuditsInput = z.object({
  object_type: z
    .enum([
      'incidents',
      'problems',
      'changes',
      'releases',
      'solutions',
      'hardwares',
      'other_assets',
    ])
    .describe(
      "The SWSD record type to fetch audits for. Use 'incidents' for tickets, " +
        "'solutions' for KB articles, etc.",
    ),
  id: z
    .number()
    .int()
    .positive()
    .describe(
      'Record id. When object_type is "incidents" or "solutions", accepts either the internal id (>=7 digits) or the human-facing number (<=6 digits / <=4 digits respectively). Other object types require the internal id.',
    ),
  page: z
    .number()
    .int()
    .min(1)
    .max(10_000)
    .default(1)
    .describe('Page number (1-indexed).'),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe('Audits per page (1-100). Older records may have hundreds of audit entries; default 25 is enough for "recent activity" reads.'),
});

export type GetRecordAuditsInput = z.infer<typeof GetRecordAuditsInput>;

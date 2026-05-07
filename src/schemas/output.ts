import { z } from 'zod';

/**
 * Pagination block emitted on every list-shaped tool response.
 * Mirrors the runtime shape returned by extractPagination().
 */
export const PaginationOutput = z.object({
  page: z.number().int().describe('Current page (1-indexed).'),
  per_page: z.number().int().describe('Items per page used in the request.'),
  total: z
    .number()
    .int()
    .optional()
    .describe('Total record count when SWSD returns X-Total-Count.'),
  has_more: z.boolean().describe('True when more pages exist beyond this one.'),
  next_page: z
    .number()
    .int()
    .optional()
    .describe('The next page number to request, when has_more is true.'),
});

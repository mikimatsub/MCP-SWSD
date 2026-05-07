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

/**
 * total_scope discriminator on pagination blocks.
 * - "filtered" — filters were applied AND SWSD returned X-Total-Count, so
 *   the total is the post-filter count.
 * - "tenant"   — no filters applied AND SWSD returned X-Total-Count, so
 *   the total is the tenant-wide count.
 * - "unknown"  — SWSD did not return X-Total-Count.
 */
export const TotalScope = z.enum(['filtered', 'tenant', 'unknown']);

/**
 * Extended pagination output that includes total_scope.
 * Used on list tools where filter-vs-tenant total disambiguation matters.
 */
export const PaginationWithScopeOutput = PaginationOutput.extend({
  total_scope: TotalScope.describe(
    "Whether `total` reflects the filtered-set size, the tenant-wide size, or is unknown. " +
      "'filtered' = filter was applied AND total is present; 'tenant' = no filter AND total is present; 'unknown' = total absent.",
  ),
});

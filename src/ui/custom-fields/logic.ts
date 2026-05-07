/**
 * Pure functions for custom-fields filtering and option extraction.
 *
 * Extracted from `index.ts` so they can be unit-tested without a DOM. The
 * render code in `index.ts` imports these and wires them to the live
 * `<input>`, `<select>`, and `<input type="checkbox">` controls; tests
 * exercise these helpers directly with synthetic field records.
 *
 * Conventions:
 *   - `matchesQuery` lower-cases both the haystack and the query — the
 *     filter input UX is case-insensitive across `name` and `help_text`.
 *   - `matchesFilters` composes the four filter dimensions (q, scope,
 *     module, activeOnly) with AND semantics. An empty string for q,
 *     scope, or module is treated as "no filter on this dimension".
 *   - `extractFilterOptions` deduplicates and alpha-sorts the unique
 *     non-empty values of a key — used to populate the scope and module
 *     <select> elements from the inbound payload.
 *   - `sortFieldsByName` is a parallel, smaller version of the `cmp`
 *     helper used in incident-list/logic.ts. Empty/missing names always
 *     sort to the end so blanks don't surface at the top of the list.
 *     Task 6 may consolidate cmp helpers; until then a parallel
 *     definition keeps modules independent.
 */

export interface CustomField {
  id: number;
  name: string;
  type: string;
  required: boolean;
  active: boolean;
  scope?: string;
  module?: string;
  values?: string[];
  help_text?: string;
  searchable: boolean;
}

export interface Filters {
  q: string;
  scope: string;
  module: string;
  activeOnly: boolean;
}

/**
 * Returns true when the field's `name` or `help_text` contains `q` as a
 * case-insensitive substring. An empty/whitespace-only query matches every
 * field. Searched fields: `name` and `help_text`.
 */
export function matchesQuery(field: CustomField, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (field.name.toLowerCase().includes(needle)) return true;
  if (typeof field.help_text === 'string' && field.help_text.toLowerCase().includes(needle)) {
    return true;
  }
  return false;
}

/**
 * Compose all four filter dimensions with AND semantics. An empty string
 * for `q`, `scope`, or `module` means "no constraint on this dimension".
 * `activeOnly=true` drops fields where `active === false`.
 */
export function matchesFilters(field: CustomField, filters: Filters): boolean {
  if (filters.activeOnly && !field.active) return false;
  if (filters.scope && field.scope !== filters.scope) return false;
  if (filters.module && field.module !== filters.module) return false;
  return matchesQuery(field, filters.q);
}

/**
 * Extract unique, non-empty values of `key` across the field set, sorted
 * alphabetically (case-insensitive). Used to populate the scope and module
 * <select> elements from the inbound payload — the dropdowns auto-tailor
 * to the tenant's actual custom-field surface.
 */
export function extractFilterOptions(
  fields: readonly CustomField[],
  key: 'scope' | 'module',
): string[] {
  const set = new Set<string>();
  for (const f of fields) {
    const v = f[key];
    if (typeof v === 'string' && v.length > 0) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Apply all filters and return a NEW array. Input is not mutated.
 */
export function filterFields(
  fields: readonly CustomField[],
  filters: Filters,
): CustomField[] {
  return fields.filter((f) => matchesFilters(f, filters));
}

/**
 * Sort fields alphabetically by name, case-insensitively. Empty-name
 * entries (defensive — the mapper guarantees non-empty in practice) sort
 * to the END so blanks don't surface at the top of the card list.
 */
export function sortFieldsByName(fields: readonly CustomField[]): CustomField[] {
  return [...fields].sort((a, b) => {
    const an = a.name;
    const bn = b.name;
    if (!an && !bn) return 0;
    if (!an) return 1;
    if (!bn) return -1;
    return an.localeCompare(bn, undefined, { sensitivity: 'base' });
  });
}

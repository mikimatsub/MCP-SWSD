/**
 * Pure functions for incident-list filtering and sorting.
 *
 * Extracted from `index.ts` so they can be unit-tested without a DOM. The
 * render code in `index.ts` imports these and wires them to the live
 * `<input>` and table headers; tests exercise `filterAndSort` directly with
 * synthetic incident records.
 *
 * Conventions:
 *   - `matchesQuery` lower-cases both the haystack and the query — the
 *     filter input UX is case-insensitive.
 *   - `cmp` puts missing values at the end regardless of sort direction.
 *     The direction multiplier is applied ONLY to the present-vs-present
 *     case so empties cluster predictably at the bottom of "asc" AND "desc".
 *   - `pickSortValue` keeps `number` numeric (so 9 < 10 sorts correctly)
 *     and reads everything else through `pickString`.
 */

import { pickString, pickNumber, pickNestedString } from '../shared/format.js';

export type Incident = Record<string, unknown>;

/** Sort keys correspond to `data-sort` attributes on the table headers. */
export type SortKey =
  | 'number'
  | 'name'
  | 'state'
  | 'priority'
  | 'assignee_email'
  | 'updated_at';

export const SORT_KEYS: ReadonlySet<SortKey> = new Set<SortKey>([
  'number',
  'name',
  'state',
  'priority',
  'assignee_email',
  'updated_at',
]);

/**
 * Returns true when the incident's searchable fields contain `q` as a
 * case-insensitive substring. An empty/whitespace-only query matches every
 * incident. Searched fields: `name`, `assignee_email`, `requester_email`,
 * and `category` (flat string or nested `category.name`).
 */
export function matchesQuery(inc: Incident, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack: Array<string | undefined> = [
    pickString(inc, 'name'),
    pickString(inc, 'assignee_email'),
    pickString(inc, 'requester_email'),
    pickString(inc, 'category') ?? pickNestedString(inc, 'category', 'name'),
  ];
  return haystack.some((v) => typeof v === 'string' && v.toLowerCase().includes(needle));
}

/**
 * Comparator for two values from the same column. Missing values
 * (undefined/null) ALWAYS sort to the end regardless of `desc`, so empty
 * cells cluster predictably at the bottom of both ascending and descending
 * views. The direction flag is applied only to the present-vs-present case.
 *
 * Numbers compare numerically; everything else compares as a stringified
 * locale comparison.
 */
export function cmp(a: unknown, b: unknown, desc: boolean): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // missing always last
  if (b == null) return -1; // present always before missing
  const r =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b));
  return desc ? -r : r;
}

/**
 * Pull the value to be sorted from an incident. Number column → numeric;
 * everything else → string (via `pickString`). Returns `undefined` when the
 * field is missing — `cmp` then routes the row to the end of the list.
 */
export function pickSortValue(inc: Incident, key: SortKey): unknown {
  if (key === 'number') return pickNumber(inc, 'number');
  return pickString(inc, key);
}

/**
 * Compose the filter + sort steps into the canonical entry point used by
 * both `index.ts` (live UI) and the unit tests. Returns a NEW array;
 * `incidents` is not mutated.
 */
export function filterAndSort(
  incidents: readonly Incident[],
  q: string,
  sortKey: SortKey,
  sortDesc: boolean,
): Incident[] {
  const filtered = incidents.filter((i) => matchesQuery(i, q));
  filtered.sort((a, b) => cmp(pickSortValue(a, sortKey), pickSortValue(b, sortKey), sortDesc));
  return filtered;
}

/**
 * Returns the sort-direction glyph for a column header.
 *
 *   - `'▲'` (U+25B2 BLACK UP-POINTING TRIANGLE) for the active column on asc
 *   - `'▼'` (U+25BC BLACK DOWN-POINTING TRIANGLE) for the active column on desc
 *   - `''` (empty string) for inactive columns
 *
 * The renderer reserves a fixed-width slot for the glyph regardless of state
 * (see `.sort-indicator` in styles.css), so toggling the sort doesn't shift
 * the header layout.
 */
export function sortIndicator(active: boolean, desc: boolean): '▲' | '▼' | '' {
  if (!active) return '';
  return desc ? '▼' : '▲';
}

/**
 * Returns the WAI-ARIA `aria-sort` attribute value for a column header.
 *
 *   - `'ascending'` for the active column on asc
 *   - `'descending'` for the active column on desc
 *   - `'none'` for inactive columns
 *
 * Per the WAI-ARIA spec these are the only valid values for a sortable
 * column. Setting `'none'` (rather than omitting the attribute) makes it
 * unambiguous to assistive tech that the column IS sortable but currently
 * unsorted.
 */
export function ariaSortValue(active: boolean, desc: boolean): 'ascending' | 'descending' | 'none' {
  if (!active) return 'none';
  return desc ? 'descending' : 'ascending';
}

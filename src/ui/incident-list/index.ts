import { onHostInit, applyHostThemeVariables } from '../shared/host.js';
import { el, clear } from '../shared/dom.js';

/**
 * Payload shape: this UI is mounted by `swsd_list_incidents`, which returns
 * `structuredContent: { incidents: IncidentSummary[], pagination: {...},
 * applied_filters: {...} }`. The IncidentSummary contract lives at
 * `src/swsd/types.ts:1-13` — flat fields, no nested objects. The pickers below
 * are still defensive against missing/malformed values arriving over the wire.
 *
 * Field mapping (IncidentSummary → table column):
 *   number          → "#"        (formatted as "#<n>")
 *   name            → "Name"     (linked via `url` when safe http(s))
 *   state           → "State"
 *   priority        → "Priority"
 *   assignee_email  → "Assignee"
 *   updated_at      → "Updated"  (formatted as locale string)
 *
 * The "url" field comes from SWSD's `href_account_domain` (mapped server-side)
 * and is not always populated. When present, it's validated by `isSafeHttpUrl`
 * (defense in depth on top of the safe-DOM helper's URL-scheme check) before
 * rendering as an anchor.
 *
 * Interactivity is purely client-side filtering of the already-passed dataset
 * — no re-invocation of the tool. A v2.5 capability could add re-invocation
 * for cross-page navigation, gated on host support.
 */

type Incident = Record<string, unknown>;

interface Pagination {
  page?: number;
  per_page?: number;
  total?: number;
  total_scope?: string;
  has_more?: boolean;
  next_page?: number;
}

interface Payload {
  incidents: Incident[];
  pagination?: Pagination;
  applied_filters?: Record<string, unknown>;
}

/** Sort keys correspond to `data-sort` attributes on the table headers. */
type SortKey =
  | 'number'
  | 'name'
  | 'state'
  | 'priority'
  | 'assignee_email'
  | 'updated_at';

const SORT_KEYS: ReadonlySet<SortKey> = new Set([
  'number',
  'name',
  'state',
  'priority',
  'assignee_email',
  'updated_at',
]);

let all: Incident[] = [];
let sortKey: SortKey = 'updated_at';
let sortDesc = true;

const titleEl = document.getElementById('title');
const searchEl = document.getElementById('search') as HTMLInputElement | null;
const rowsEl = document.getElementById('rows');
const emptyEl = document.getElementById('empty') as HTMLParagraphElement | null;

if (!titleEl || !searchEl || !rowsEl || !emptyEl) {
  throw new Error('incident-list UI: missing one of #title, #search, #rows, #empty');
}

onHostInit<Payload>((msg) => {
  applyHostThemeVariables(msg.styles?.variables);
  if (Array.isArray(msg.data?.incidents)) {
    all = msg.data.incidents;
  }
  updateTitle(all.length, msg.data?.pagination);
  render();
});

searchEl.addEventListener('input', render);
document.querySelectorAll<HTMLTableCellElement>('th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const raw = th.getAttribute('data-sort');
    if (!raw || !SORT_KEYS.has(raw as SortKey)) return;
    const key = raw as SortKey;
    if (sortKey === key) {
      sortDesc = !sortDesc;
    } else {
      sortKey = key;
      sortDesc = false;
    }
    render();
  });
});

function updateTitle(shown: number, pagination: Pagination | undefined): void {
  if (!titleEl) return;
  const total = pagination?.total;
  const scope = typeof pagination?.total_scope === 'string' ? pagination.total_scope : undefined;
  if (typeof total === 'number') {
    titleEl.textContent = `Incidents (${String(shown)} of ${String(total)}${
      scope ? `, ${scope}` : ''
    })`;
  } else {
    titleEl.textContent = `Incidents (${String(shown)})`;
  }
}

function render(): void {
  if (!searchEl || !rowsEl || !emptyEl) return;
  const q = searchEl.value.trim().toLowerCase();
  const filtered = all.filter((i) => matchesQuery(i, q));
  filtered.sort((a, b) => cmp(pickSortValue(a, sortKey), pickSortValue(b, sortKey)) * (sortDesc ? -1 : 1));

  clear(rowsEl);
  for (const i of filtered) {
    rowsEl.appendChild(renderRow(i));
  }
  emptyEl.hidden = filtered.length > 0;
}

function matchesQuery(inc: Incident, q: string): boolean {
  if (!q) return true;
  const haystack: Array<string | undefined> = [
    pickString(inc, 'name'),
    pickString(inc, 'assignee_email'),
    pickString(inc, 'requester_email'),
    pickString(inc, 'category') ?? pickNestedString(inc, 'category', 'name'),
  ];
  return haystack.some((v) => typeof v === 'string' && v.toLowerCase().includes(q));
}

function renderRow(inc: Incident): HTMLTableRowElement {
  const number = pickNumber(inc, 'number');
  const name = pickString(inc, 'name') ?? '';
  const state = pickString(inc, 'state') ?? '';
  const priority = pickString(inc, 'priority') ?? '';
  const assignee = pickString(inc, 'assignee_email') ?? pickNestedString(inc, 'assignee', 'email') ?? '';
  const updatedAt = pickString(inc, 'updated_at');
  const url = pickString(inc, 'url') ?? pickString(inc, 'href_account_domain');

  const numberCell = el('td', undefined, [number !== undefined ? `#${String(number)}` : '']);
  const nameCell =
    name && url && isSafeHttpUrl(url)
      ? el('td', undefined, [
          el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, [name]),
        ])
      : el('td', undefined, [name]);

  return el('tr', undefined, [
    numberCell,
    nameCell,
    el('td', undefined, [state]),
    el('td', undefined, [priority]),
    el('td', undefined, [assignee]),
    el('td', undefined, [updatedAt ? formatDate(updatedAt) : '']),
  ]);
}

function pickSortValue(inc: Incident, key: SortKey): unknown {
  // The "category" key isn't sortable in this UI, so all SortKey values map
  // 1:1 onto IncidentSummary fields. Number → numeric sort, everything else
  // → string sort via cmp().
  if (key === 'number') return pickNumber(inc, 'number');
  return pickString(inc, key);
}

function cmp(a: unknown, b: unknown): number {
  // Push undefined/null to the end regardless of sort direction so empty
  // values cluster predictably at the bottom of "asc" and the top of "desc".
  // (The existing UX decision, mirrored by other ITSM apps.)
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function pickString(obj: Incident, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function pickNumber(obj: Incident, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function pickNestedString(
  obj: Incident,
  parentKey: string,
  childKey: string,
): string | undefined {
  const parent = obj[parentKey];
  if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
    const v = (parent as Record<string, unknown>)[childKey];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * Defense in depth on top of the safe-DOM helper's URL-scheme check: only
 * render an anchor when the source URL looks like an http(s) absolute URL or
 * a same-origin relative path. Anything else falls through to plain text.
 */
function isSafeHttpUrl(s: string): boolean {
  if (s.startsWith('/')) return true;
  return /^https?:\/\//i.test(s);
}

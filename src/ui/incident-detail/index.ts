import { onHostInit, applyHostThemeVariables } from '../shared/host.js';
import { el, clear } from '../shared/dom.js';

/**
 * Payload shape: this UI is mounted by `swsd_get_incident`, which returns
 * `structuredContent: { incident: <raw SWSD incident> }` where the raw shape
 * is a passthrough of SWSD's GET /incidents/{id}.json response (see
 * `src/swsd/mappers/incident.ts:toIncidentDetail`).
 *
 * Field mapping (SWSD raw → UI):
 *   id                                   → header
 *   number                               → "Number"
 *   name                                 → header
 *   state                                → "State"
 *   priority                             → "Priority"
 *   assignee.email | assignee_email      → "Assignee"
 *   requester.email | requester_email    → "Requester"
 *   category.name | category             → "Category"
 *   updated_at                           → "Updated" (formatted as locale string)
 *   href_account_domain | url            → "Open in SWSD" link
 *
 * Both the flat-summary form and the nested-raw form are accepted so the
 * same UI component renders correctly whether the host hands us a mapped
 * `IncidentSummary` or the raw passthrough from `getIncident`.
 */

type Incident = Record<string, unknown>;

interface Payload {
  incident: Incident;
}

const root = document.getElementById('root');
if (!root) throw new Error('incident-detail UI: missing #root');
root.appendChild(el('p', { class: 'loading' }, ['Loading incident…']));

onHostInit<Payload>((msg) => {
  applyHostThemeVariables(msg.styles?.variables);
  if (msg.data?.incident) render(root, msg.data.incident);
});

function render(rootEl: HTMLElement, inc: Incident): void {
  const fields: Array<[string, string]> = [];
  const number = pickNumber(inc, 'number');
  if (number !== undefined) fields.push(['Number', `#${String(number)}`]);

  const state = pickString(inc, 'state');
  if (state) fields.push(['State', state]);

  const priority = pickString(inc, 'priority');
  if (priority) fields.push(['Priority', priority]);

  const assignee = pickString(inc, 'assignee_email') ?? pickNestedString(inc, 'assignee', 'email');
  if (assignee) fields.push(['Assignee', assignee]);

  const requester = pickString(inc, 'requester_email') ?? pickNestedString(inc, 'requester', 'email');
  if (requester) fields.push(['Requester', requester]);

  const category = pickString(inc, 'category') ?? pickNestedString(inc, 'category', 'name');
  if (category) fields.push(['Category', category]);

  const updatedAt = pickString(inc, 'updated_at');
  if (updatedAt) fields.push(['Updated', formatDate(updatedAt)]);

  const dl = el('dl');
  for (const [k, v] of fields) {
    dl.appendChild(el('dt', undefined, [k]));
    dl.appendChild(el('dd', undefined, [v]));
  }

  const name = pickString(inc, 'name') ?? `Incident ${String(pickNumber(inc, 'id') ?? '')}`;
  const url = pickString(inc, 'url') ?? pickString(inc, 'href_account_domain');

  const headerChildren: Node[] = [el('h1', undefined, [name])];
  if (url && isSafeHttpUrl(url)) {
    headerChildren.push(
      el(
        'a',
        { class: 'open-in-swsd', href: url, target: '_blank', rel: 'noopener noreferrer' },
        ['Open in SWSD ↗'],
      ),
    );
  }

  clear(rootEl);
  rootEl.appendChild(el('header', undefined, headerChildren));
  rootEl.appendChild(dl);
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
 * render an "Open in SWSD" link when the source URL looks like an http(s)
 * absolute URL or a same-origin relative path. Anything else just falls
 * through to no-link rendering.
 */
function isSafeHttpUrl(s: string): boolean {
  if (s.startsWith('/')) return true;
  return /^https?:\/\//i.test(s);
}

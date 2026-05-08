import { mountApp } from '../shared/host.js';
import { el, clear } from '../shared/dom.js';
import { renderError } from '../shared/error.js';
import { sanitizeHtml } from '../shared/sanitizeHtml.js';
import {
  pickString,
  pickNumber,
  pickNestedString,
  formatDate,
  isSafeHttpUrl,
} from '../shared/format.js';

/**
 * Payload shape: this UI is mounted by `swsd_get_incident`, which returns
 * `structuredContent: { incident: <raw SWSD incident> }` where the raw shape
 * is a passthrough of SWSD's GET /incidents/{id}.json?layout=long response
 * (see `src/swsd/mappers/incident.ts:toIncidentDetail`).
 *
 * Field mapping (SWSD raw -> UI):
 *   id                                   -> header / fallback name
 *   number                               -> header "#<n>"
 *   name                                 -> header
 *   state                                -> badge + meta
 *   priority                             -> badge + meta
 *   due_at                               -> meta "Due" + Overdue badge if past
 *   created_at                           -> meta "Created"
 *   updated_at                           -> meta "Updated" (locale string)
 *   sla_violations[]                     -> SLA badge with row count
 *   assignee.email | assignee_email      -> meta "Assignee"
 *   requester.email | requester_email    -> meta "Requester"
 *   category.name | category             -> meta "Category"
 *   description (HTML)                   -> sanitized .incident-description.prose
 *   resolution (HTML)                    -> sanitized .incident-resolution.prose
 *   resolution_type                      -> heading suffix on resolution section
 *   href_account_domain | url            -> "Open in SWSD" link
 *
 * Both the flat-summary form and the nested-raw form are accepted so the
 * same UI component renders correctly whether the host hands us a mapped
 * `IncidentSummary` or the raw passthrough from `getIncident`.
 *
 * Sanitization rule: every HTML body is routed through `sanitizeHtml`
 * (DOMPurify allow-list) before being assigned to the DOM. The
 * `setSanitizedBody` helper centralizes the one place a raw HTML string
 * touches the DOM so it stays auditable.
 */

export type Incident = Record<string, unknown>;

export interface Payload {
  incident: Incident;
}

const root = document.getElementById('root');
if (!root) throw new Error('incident-detail UI: missing #root');
root.appendChild(el('p', { class: 'loading' }, ['Loading incident…']));

mountApp<Payload>({
  name: 'swsd-mcp/incident-detail',
  version: '2.1.0',
  onResult: (data) => {
    if (data?.incident) renderIncident(root, data.incident);
  },
  onError: ({ message }) => {
    renderError(root, message);
  },
}).catch((err) => {
  console.error('incident-detail: failed to connect MCP App', err);
});

/**
 * Render the incident into `rootEl`. Pure function over `inc` -> DOM
 * mutations; no module-level state, no async work, exported so the unit
 * tests can drive it without going through the MCP Apps handshake.
 */
export function renderIncident(rootEl: HTMLElement, inc: Incident): void {
  clear(rootEl);

  const number = pickNumber(inc, 'number');
  const name =
    pickString(inc, 'name') ?? `Incident ${String(pickNumber(inc, 'id') ?? '')}`;
  const headerTitle =
    number !== undefined ? `#${String(number)} — ${name}` : name;

  const url = pickString(inc, 'url') ?? pickString(inc, 'href_account_domain');

  const headerChildren: Node[] = [el('h1', undefined, [headerTitle])];
  if (url && isSafeHttpUrl(url)) {
    headerChildren.push(
      el(
        'a',
        { class: 'open-in-swsd', href: url, target: '_blank', rel: 'noopener noreferrer' },
        ['Open in SWSD ↗'],
      ),
    );
  }

  // Header bar: title + (optional) "Open in SWSD" link.
  rootEl.appendChild(el('header', undefined, headerChildren));

  // Badge row: state, priority, overdue (if applicable), SLA-violation count.
  const badges = renderBadges(inc);
  if (badges) rootEl.appendChild(badges);

  // Meta dl: assignee, requester, category, created, updated, due (with
  // .overdue when applicable). Skip rows with no value so we don't render an
  // empty dt/dd pair.
  rootEl.appendChild(renderMeta(inc));

  // Description body (HTML, sanitized) — only when present.
  const description = pickString(inc, 'description');
  if (description) {
    const section = el('section', { class: 'incident-description' });
    section.appendChild(el('h2', undefined, ['Description']));
    const body = el('div', { class: 'prose' });
    setSanitizedBody(body, description);
    section.appendChild(body);
    rootEl.appendChild(section);
  }

  // Resolution body (HTML, sanitized) — only when present. Heading shows the
  // resolution_type when SWSD provides one (e.g. "Resolved by IT").
  const resolution = pickString(inc, 'resolution');
  if (resolution) {
    const resolutionType = pickString(inc, 'resolution_type');
    const heading = resolutionType
      ? `Resolution — ${resolutionType}`
      : 'Resolution';
    const section = el('section', { class: 'incident-resolution' });
    section.appendChild(el('h2', undefined, [heading]));
    const body = el('div', { class: 'prose' });
    setSanitizedBody(body, resolution);
    section.appendChild(body);
    rootEl.appendChild(section);
  }
}

function renderBadges(inc: Incident): HTMLElement | null {
  const state = pickString(inc, 'state');
  const priority = pickString(inc, 'priority');
  const dueAt = pickString(inc, 'due_at');
  const slaCount = countSlaViolations(inc);
  const overdue = isOverdue(dueAt);

  if (!state && !priority && !overdue && slaCount === 0) return null;

  const row = el('div', { class: 'incident-badges' });
  if (state) row.appendChild(el('span', { class: 'badge-state' }, [state]));
  if (priority)
    row.appendChild(el('span', { class: 'badge-priority' }, [priority]));
  if (overdue)
    row.appendChild(el('span', { class: 'badge-overdue' }, ['Overdue']));
  if (slaCount > 0) {
    const label =
      slaCount === 1 ? '1 SLA violation' : `${String(slaCount)} SLA violations`;
    row.appendChild(el('span', { class: 'badge-sla' }, [label]));
  }
  return row;
}

function renderMeta(inc: Incident): HTMLElement {
  const dl = el('dl');

  const assignee =
    pickString(inc, 'assignee_email') ?? pickNestedString(inc, 'assignee', 'email');
  if (assignee) appendRow(dl, 'Assignee', assignee);

  const requester =
    pickString(inc, 'requester_email') ?? pickNestedString(inc, 'requester', 'email');
  if (requester) appendRow(dl, 'Requester', requester);

  const category =
    pickString(inc, 'category') ?? pickNestedString(inc, 'category', 'name');
  if (category) appendRow(dl, 'Category', category);

  const createdAt = pickString(inc, 'created_at');
  if (createdAt) appendRow(dl, 'Created', formatDate(createdAt));

  const updatedAt = pickString(inc, 'updated_at');
  if (updatedAt) appendRow(dl, 'Updated', formatDate(updatedAt));

  const dueAt = pickString(inc, 'due_at');
  if (dueAt) {
    appendRow(dl, 'Due', formatDate(dueAt), isOverdue(dueAt) ? 'overdue' : undefined);
  }

  return dl;
}

function appendRow(
  dl: HTMLElement,
  label: string,
  value: string,
  ddClass?: string,
): void {
  dl.appendChild(el('dt', undefined, [label]));
  dl.appendChild(el('dd', ddClass ? { class: ddClass } : undefined, [value]));
}

/**
 * True when `dueAt` is a parseable ISO 8601 timestamp in the past. Returns
 * `false` for missing/empty/unparseable inputs so callers can use it as a
 * simple "show overdue badge?" predicate without an extra null check.
 *
 * Exported so tests can exercise the predicate without driving the full
 * render pipeline.
 */
export function isOverdue(dueAt?: string): boolean {
  if (typeof dueAt !== 'string' || dueAt.length === 0) return false;
  const t = Date.parse(dueAt);
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

/**
 * Count entries in the `sla_violations[]` array, defensively. Non-array
 * shapes return 0 so the rendering branch can rely on a simple comparison.
 */
function countSlaViolations(inc: Incident): number {
  const v = inc.sla_violations;
  return Array.isArray(v) ? v.length : 0;
}

/**
 * Apply pre-sanitized HTML to an element. Centralized so the one place a
 * raw HTML string is written into the DOM is auditable: callers pass HTML
 * to be rendered through `sanitizeHtml` first (DOMPurify wraps the write).
 *
 * Mirrors the comment-thread / catalog-item-form pattern.
 */
function setSanitizedBody(target: HTMLElement, html: string): void {
  // Pre-sanitized via DOMPurify allow-list -- see sanitizeHtml.ts.
  (target as unknown as { innerHTML: string }).innerHTML = sanitizeHtml(html);
}

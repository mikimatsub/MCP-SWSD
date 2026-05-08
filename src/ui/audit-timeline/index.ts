import { mountApp } from '../shared/host.js';
import { el, clear } from '../shared/dom.js';
import { renderError } from '../shared/error.js';
import { formatDate } from '../shared/format.js';

/**
 * Payload shape: this UI is mounted by `swsd_get_record_audits`, which
 * returns `structuredContent: { audits: AuditSummary[], pagination: {...} }`.
 * The AuditSummary contract lives at `src/swsd/types.ts:154-173`.
 *
 * Field mapping (AuditSummary -> UI):
 *   uuid           -> `data-audit-uuid` row key (per
 *                    `verified_swsd_api_quirks.md`: SWSD assigns no numeric
 *                    id, only a UUID)
 *   action         -> action chip text + icon glyph (Created/Updated/Deleted)
 *   message        -> main change description (parsed for "X changed from A
 *                    to B" to render an old -> new diff; falls back to the
 *                    raw message)
 *   user           -> user-attribution span
 *   created_at     -> timestamp + day-group key (formatted via toLocaleString)
 *
 * Rendering pattern:
 * - Safe DOM helpers (`el` / `clear`) for everything. Audit values may
 *   contain HTML-like strings but we render them as plain text via
 *   `textContent`. There is no sanitization step here because there is no
 *   raw HTML pathway: every string lands in a text node.
 * - Empty state: when `audits.length === 0`, show
 *   "No history recorded for this record."
 * - Error state: forwarded to the shared `renderError` so a tool returning
 *   `isError: true` doesn't leave the iframe stuck on "Loading..." forever.
 *
 * Day grouping: entries are bucketed by their local-date string (the key
 * used by `formatDayKey`). Within each day the original payload order is
 * preserved -- server-side `?sort=` order is the source of truth.
 */

export interface Audit {
  uuid: string;
  message: string;
  action?: string;
  created_at?: string;
  user?: string;
  user_id?: number;
  note?: string;
  source_type?: string;
  source_id?: number;
}

export interface Payload {
  audits: Audit[];
  // pagination is not used by the widget today; we accept it (and the rest)
  // as `unknown` extras so unknown future fields don't break rendering.
}

const root = document.getElementById('root');
if (!root) throw new Error('audit-timeline UI: missing #root');

mountApp<Payload>({
  name: 'swsd-mcp/audit-timeline',
  version: '2.1.0',
  onResult: (data) => {
    if (data) renderTimeline(root, data);
  },
  onError: ({ message }) => {
    renderError(root, message);
  },
}).catch((err) => {
  console.error('audit-timeline: failed to connect MCP App', err);
});

/**
 * Render the audit timeline into `rootEl`. Pure function over `payload` ->
 * DOM mutations; no module-level state, no async work, exported so the unit
 * tests can drive it without going through the MCP Apps handshake.
 */
export function renderTimeline(rootEl: HTMLElement, payload: Payload): void {
  const audits = Array.isArray(payload.audits) ? payload.audits : [];

  clear(rootEl);

  // Header -- shows the audit count so the user knows whether this is "all
  // history" or just one page.
  rootEl.appendChild(
    el('header', { class: 'timeline-header' }, [
      el('h1', undefined, [`Audit history (${String(audits.length)})`]),
    ]),
  );

  if (audits.length === 0) {
    rootEl.appendChild(
      el('div', { class: 'empty-state' }, ['No history recorded for this record.']),
    );
    return;
  }

  const timeline = el('div', { class: 'timeline' });
  // Group consecutive entries that share the same day-key. We don't sort --
  // the server's order is preserved -- so a day-group runs as long as the
  // current day-key matches the previous entry's day-key. If the same date
  // appears non-consecutively (the server returns audits out of date order),
  // each cluster gets its own header. That's intentional: re-ordering would
  // hide the upstream data shape and surprise users sorting by something
  // other than created_at.
  let currentDayKey: string | null = null;
  let currentList: HTMLUListElement | null = null;
  for (const audit of audits) {
    const dayKey = formatDayKey(audit.created_at);
    if (dayKey !== currentDayKey) {
      const dayGroup = el('section', { class: 'day-group' }, [
        el('h2', undefined, [dayKey]),
      ]);
      currentList = el('ul', { class: 'audit-list' });
      dayGroup.appendChild(currentList);
      timeline.appendChild(dayGroup);
      currentDayKey = dayKey;
    }
    if (currentList) {
      currentList.appendChild(renderAudit(audit));
    }
  }
  rootEl.appendChild(timeline);
}

function renderAudit(audit: Audit): HTMLLIElement {
  const action = (audit.action ?? '').trim();
  const actionKind = classifyAction(action);
  const iconGlyph = iconForAction(actionKind);
  const timeText = audit.created_at ? formatDate(audit.created_at) : '';
  const user = audit.user?.trim();
  const diff = parseDiff(audit.message);

  const headerChildren: Array<Node | string> = [];
  if (action) {
    headerChildren.push(
      el(
        'span',
        { class: `badge badge-${actionKind}` },
        [action],
      ),
    );
  }
  if (diff) {
    headerChildren.push(el('span', { class: 'audit-field' }, [diff.field]));
  }
  if (user) {
    headerChildren.push(el('span', { class: 'audit-user' }, [`by ${user}`]));
  }
  if (timeText) {
    headerChildren.push(el('time', { class: 'audit-time' }, [timeText]));
  }

  const bodyChildren: Array<Node | string> = [
    el('header', undefined, headerChildren),
  ];

  if (diff) {
    // Old -> New value rendering: both sides go through `code` elements
    // (text nodes via the el helper, so HTML-looking content is escaped).
    const diffChildren: Array<Node | string> = [];
    if (diff.from) {
      diffChildren.push(el('code', undefined, [diff.from]));
    }
    diffChildren.push(el('span', { class: 'audit-diff-arrow' }, ['->']));
    if (diff.to) {
      diffChildren.push(el('code', undefined, [diff.to]));
    }
    bodyChildren.push(el('p', { class: 'audit-diff' }, diffChildren));
  } else if (audit.message) {
    bodyChildren.push(el('p', { class: 'audit-message' }, [audit.message]));
  }

  return el(
    'li',
    {
      class: 'audit-entry',
      'data-audit-uuid': audit.uuid,
    },
    [
      el(
        'div',
        { class: `audit-icon audit-icon-${actionKind}`, 'aria-hidden': 'true' },
        [iconGlyph],
      ),
      el('div', { class: 'audit-body' }, bodyChildren),
    ],
  );
}

type ActionKind = 'created' | 'updated' | 'deleted';

/**
 * Map the SWSD audit `action` string to the small set of kinds the widget
 * styles. Inputs vary in case ("Update" vs "update") and verb form
 * ("Created" vs "Add"); normalize them here so the badge/icon classes stay
 * stable. Anything we can't classify falls back to 'updated' -- the most
 * neutral choice (yellow badge / pencil icon).
 */
function classifyAction(action: string): ActionKind {
  const lower = action.toLowerCase();
  if (lower.includes('creat') || lower.includes('add')) return 'created';
  if (lower.includes('delet') || lower.includes('remov')) return 'deleted';
  return 'updated';
}

/**
 * Pick a Unicode glyph that visually distinguishes the three action kinds.
 * Kept inline (no icon font) to avoid a bundle-size hit and to keep the
 * widget self-contained -- SWSD audit pages are read so often that even a
 * small async fetch would be wasteful.
 */
function iconForAction(kind: ActionKind): string {
  switch (kind) {
    case 'created':
      return '▶'; // black right-pointing triangle
    case 'deleted':
      return '✕'; // multiplication X
    case 'updated':
    default:
      return '✎'; // lower right pencil
  }
}

interface ParsedDiff {
  field: string;
  from: string;
  to: string;
}

/**
 * Parse SWSD's "X changed from A to B" message format into structured
 * field/from/to parts. Returns `null` when the message doesn't match -- the
 * caller falls back to rendering the raw message.
 *
 * The heuristic intentionally errs on the side of "no diff" rather than
 * "wrong diff": if the regex matches but produces empty halves, we discard
 * the parse so the user sees the raw message instead of an empty arrow.
 */
function parseDiff(message: string): ParsedDiff | null {
  if (typeof message !== 'string' || message.length === 0) return null;
  // Match "<field> changed from <from> to <to>" -- capture greedily on the
  // field side (to handle multi-word labels like "Custom Field A") and
  // lazily on the from-side (so a value containing the word "to" doesn't
  // confuse the boundary).
  const match = /^(.+?) changed from (.+?) to (.+)$/.exec(message);
  if (!match) return null;
  const field = match[1]?.trim() ?? '';
  const from = match[2]?.trim() ?? '';
  const to = match[3]?.trim() ?? '';
  if (!field || (!from && !to)) return null;
  return { field, from, to };
}

/**
 * Format an ISO timestamp as a date-only key for day-grouping. Falls back to
 * "Unknown date" when `created_at` is missing or unparseable, so the entry
 * still renders inside a labelled bucket. We use `toLocaleDateString` rather
 * than slicing the raw ISO so the day boundary respects the viewer's locale.
 */
function formatDayKey(iso: string | undefined): string {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

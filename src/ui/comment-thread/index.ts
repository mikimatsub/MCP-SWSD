import { mountApp } from '../shared/host.js';
import { el, clear } from '../shared/dom.js';
import { renderError } from '../shared/error.js';
import { sanitizeHtml } from '../shared/sanitizeHtml.js';
import { formatDate } from '../shared/format.js';

/**
 * Payload shape: this UI is mounted by `swsd_list_incident_comments`, which
 * returns `structuredContent: { comments: CommentSummary[], pagination: {...},
 * incident_id: number }`. The CommentSummary contract lives at
 * `src/swsd/types.ts:39-46` — flat fields, with `body` as HTML.
 *
 * Field mapping (CommentSummary → UI):
 *   id              → row key
 *   body            → sanitized HTML in .comment-content
 *   is_private      → border + private badge styling
 *   author_name     → .comment-author + avatar initials
 *   author_email    → fallback when author_name is missing
 *   created_at      → .comment-time (formatted as locale string)
 *
 * `incident_id` is the resolved numeric id from the tool — we render it in
 * the header so the user knows which ticket the comments belong to (the
 * iframe is sandboxed, so context from chat doesn't carry over).
 *
 * Rendering pattern:
 * - Safe DOM helpers (`el` / `clear`) for everything except the body
 * - The HTML body is sanitized via DOMPurify (`sanitizeHtml`) and assigned to
 *   the comment-content element. The sanitized output is the only place
 *   raw HTML strings appear in this widget. See the inline comment by the
 *   assignment for details.
 * - Empty state: when `comments.length === 0`, show
 *   "No comments yet on this ticket."
 * - Error state: forwarded to the shared `renderError` so a tool returning
 *   `isError: true` doesn't leave the iframe stuck on "Loading…" forever.
 */

export interface Comment {
  id: number;
  body: string;
  is_private: boolean;
  author_name?: string;
  author_email?: string;
  created_at?: string;
}

export interface Payload {
  comments: Comment[];
  incident_id?: number;
  // pagination is not used by the widget today; we accept it (and the rest)
  // as `unknown` extras so unknown future fields don't break rendering.
}

const root = document.getElementById('root');
if (!root) throw new Error('comment-thread UI: missing #root');

mountApp<Payload>({
  name: 'swsd-mcp/comment-thread',
  version: '2.1.0',
  onResult: (data) => {
    if (data) renderThread(root, data);
  },
  onError: ({ message }) => {
    renderError(root, message);
  },
}).catch((err) => {
  console.error('comment-thread: failed to connect MCP App', err);
});

/**
 * Render the comment thread into `rootEl`. Pure function over `payload` →
 * DOM mutations; no module-level state, no async work, exported so the unit
 * tests can drive it without going through the MCP Apps handshake.
 */
export function renderThread(rootEl: HTMLElement, payload: Payload): void {
  const comments = Array.isArray(payload.comments) ? payload.comments : [];
  const incidentId = typeof payload.incident_id === 'number' ? payload.incident_id : undefined;

  clear(rootEl);

  // Header — shows comment count and (when available) the incident id so the
  // iframe surface tells the user which ticket they're looking at.
  const headerTitle =
    incidentId !== undefined
      ? `Comments on incident #${String(incidentId)} (${String(comments.length)})`
      : `Comments (${String(comments.length)})`;
  rootEl.appendChild(
    el('header', { class: 'thread-header' }, [el('h1', undefined, [headerTitle])]),
  );

  if (comments.length === 0) {
    rootEl.appendChild(
      el('div', { class: 'empty-state' }, ['No comments yet on this ticket.']),
    );
    return;
  }

  const thread = el('div', { class: 'thread' });
  for (const comment of comments) {
    thread.appendChild(renderComment(comment));
  }
  rootEl.appendChild(thread);
}

function renderComment(comment: Comment): HTMLElement {
  const authorName = (comment.author_name ?? comment.author_email ?? 'Unknown').trim() || 'Unknown';
  const initials = computeInitials(authorName);
  const timeText = comment.created_at ? formatDate(comment.created_at) : '';

  const headerChildren: Array<Node | string> = [
    el('span', { class: 'comment-author' }, [authorName]),
  ];
  if (comment.is_private) {
    headerChildren.push(el('span', { class: 'badge-private' }, ['Private']));
  }
  if (timeText) {
    headerChildren.push(el('time', { class: 'comment-time' }, [timeText]));
  }

  const bodyEl = el('div', { class: 'comment-content prose' });
  // Trusted assignment: the right-hand side is the output of `sanitizeHtml`,
  // a DOMPurify wrapper with a strict allow-list (see sanitizeHtml.ts).
  // The allow-list rejects <script>/<style>/<iframe>, inline event handlers,
  // and dangerous URL schemes — the assignment is safe by construction here.
  setSanitizedBody(bodyEl, comment.body ?? '');

  const main = el('div', { class: 'comment-main' }, [
    el('div', { class: 'comment-header' }, headerChildren),
    bodyEl,
  ]);

  return el('article', { class: comment.is_private ? 'comment comment-private' : 'comment' }, [
    el('div', { class: 'comment-avatar', 'aria-hidden': 'true' }, [initials]),
    main,
  ]);
}

/**
 * Compute up-to-2-character initials from a name string. Splits on whitespace
 * and uses the first character of the first token plus the first character
 * of the last token; falls back to '?' when the input is empty after trimming.
 */
function computeInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return '?';
  const first = tokens[0]?.[0] ?? '';
  const second = tokens.length > 1 ? (tokens[tokens.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase() || '?';
}

/**
 * Apply pre-sanitized HTML to an element. Centralized so the one place a raw
 * HTML string is written into the DOM is auditable: callers must pass the
 * output of {@link sanitizeHtml}, never an untrusted string.
 */
function setSanitizedBody(target: HTMLElement, html: string): void {
  // Pre-sanitized via DOMPurify allow-list — see sanitizeHtml.ts.
  target.innerHTML = sanitizeHtml(html);
}

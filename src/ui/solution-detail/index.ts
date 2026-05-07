import { onHostInit, applyHostThemeVariables } from '../shared/host.js';
import { el, clear } from '../shared/dom.js';

/**
 * Payload shape: this UI is mounted by `swsd_get_solution`, which returns
 * `structuredContent: { solution: <raw SWSD solution> }` where the raw shape
 * is a passthrough of SWSD's GET /solutions/{id}.json response (see
 * `src/swsd/mappers/solution.ts:toSolutionDetail`).
 *
 * Field mapping (SWSD raw → UI):
 *   id                                   → header
 *   number                               → "Number"
 *   name                                 → header
 *   state                                → "State"
 *   category.name | category             → "Category"
 *   requester.email | requester_email    → "Author"
 *   updated_at                           → "Updated" (formatted as locale string)
 *   description_no_html | excerpt        → trailing paragraph (.excerpt)
 *
 * No "Open in SWSD" link: solutions expose an API-relative `href`
 * (e.g. `/solutions/1234.json`), not a UI URL — see
 * `src/swsd/types.ts:77-88` for the SolutionSummary contract.
 *
 * Both the flat-summary form (mapped `SolutionSummary`) and the nested-raw
 * form (passthrough from `getSolution`) are accepted so the same UI
 * component renders correctly in either case.
 */

type Solution = Record<string, unknown>;

interface Payload {
  solution: Solution;
}

const root = document.getElementById('root');
if (!root) throw new Error('solution-detail UI: missing #root');
root.appendChild(el('p', { class: 'loading' }, ['Loading solution…']));

onHostInit<Payload>((msg) => {
  applyHostThemeVariables(msg.styles?.variables);
  if (msg.data?.solution) render(root, msg.data.solution);
});

function render(rootEl: HTMLElement, sol: Solution): void {
  const fields: Array<[string, string]> = [];
  const number = pickNumber(sol, 'number');
  if (number !== undefined) fields.push(['Number', `#${String(number)}`]);

  const state = pickString(sol, 'state');
  if (state) fields.push(['State', state]);

  const category = pickString(sol, 'category') ?? pickNestedString(sol, 'category', 'name');
  if (category) fields.push(['Category', category]);

  const author = pickString(sol, 'requester_email') ?? pickNestedString(sol, 'requester', 'email');
  if (author) fields.push(['Author', author]);

  const updatedAt = pickString(sol, 'updated_at');
  if (updatedAt) fields.push(['Updated', formatDate(updatedAt)]);

  const dl = el('dl');
  for (const [k, v] of fields) {
    dl.appendChild(el('dt', undefined, [k]));
    dl.appendChild(el('dd', undefined, [v]));
  }

  const name = pickString(sol, 'name') ?? `Solution ${String(pickNumber(sol, 'id') ?? '')}`;

  clear(rootEl);
  rootEl.appendChild(el('header', undefined, [el('h1', undefined, [name])]));
  rootEl.appendChild(dl);

  const excerpt = pickString(sol, 'excerpt') ?? pickString(sol, 'description_no_html');
  if (excerpt) {
    rootEl.appendChild(el('p', { class: 'excerpt' }, [excerpt]));
  }
}

function pickString(obj: Solution, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function pickNumber(obj: Solution, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function pickNestedString(
  obj: Solution,
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

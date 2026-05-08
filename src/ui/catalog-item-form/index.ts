import { mountApp } from '../shared/host.js';
import { el, clear } from '../shared/dom.js';
import { renderError } from '../shared/error.js';
import { sanitizeHtml } from '../shared/sanitizeHtml.js';
import type { App } from '@modelcontextprotocol/ext-apps';

/**
 * Payload shape: this UI is mounted by `swsd_get_catalog_item`, which
 * returns `structuredContent: { item: CatalogItemDetail }`. The
 * CatalogItemDetail contract lives at `src/swsd/types.ts:229-233` and the
 * CatalogItemVariable contract at `src/swsd/types.ts:196-211`.
 *
 * What's transformative here: this is the first widget that calls back into
 * the server. On submit we invoke `app.callServerTool('swsd_create_service_request', ...)`
 * (method name verified from
 * `node_modules/@modelcontextprotocol/ext-apps/dist/src/app.d.ts:917`:
 *
 *   callServerTool(params: CallToolRequest["params"], options?: RequestOptions): Promise<CallToolResult>;
 *
 * — confirmed during Task 13 research-first pass) which collapses the
 * 4-round-trip service-request workflow (list -> get -> fill via chat ->
 * create) to 2 round-trips (get -> submit-from-widget). The chat surface
 * becomes a real interaction surface, not just a rendering target.
 *
 * Field mapping (CatalogItemVariable -> form input):
 *   kind: 'free_text'        -> <input type="text">
 *   kind: 'drop_down_menu'   -> <select> with options from newline-split `options`
 *   kind: 'multi_select'     -> <select multiple> with options
 *   kind: 'date'             -> <input type="date">
 *   kind: 'user'             -> <input type="email">
 *   kind: null/other         -> filtered out (section headers / textareas;
 *                               they are SWSD legacy multi-line label rows
 *                               that aren't expected on submission per the
 *                               wire-shape probes).
 *
 * required === '1' adds a visible asterisk + the `required` HTML attribute.
 * `helptext` is HTML and is sanitized via DOMPurify before render -- SWSD
 * stores it as authored markup (paragraphs, lists, line breaks).
 *
 * Submit semantics:
 *   - Build `request_variables: [{ custom_field_id: variable.id, value }]`,
 *     skipping empty values so the agent can leave optional fields blank.
 *   - `requester_email` is intentionally omitted; the server-side handler
 *     (src/tools/catalog/createServiceRequest.ts:64-91) self-resolves the
 *     authenticated user from the JWT when the field is absent. That's the
 *     correct UX for the chat surface: the user submitting from the widget
 *     IS the requester.
 *   - On success: status flips to "Submitted successfully." with the new
 *     ticket number rendered when the response includes one.
 *   - On error: status flips to red with the error message; submit button
 *     is re-enabled so the user can retry after fixing inputs.
 */

export interface CatalogVariable {
  id: number;
  name: string;
  kind?: string;
  field_type?: number;
  options?: string;
  required?: string;
  helptext?: string;
}

export interface CatalogItem {
  id: number;
  name?: string;
  description?: string;
  variables?: CatalogVariable[];
  // Pass-through extras from SWSD; we ignore them here.
  [key: string]: unknown;
}

export interface Payload {
  item: CatalogItem;
}

const root = document.getElementById('root');
if (!root) throw new Error('catalog-item-form UI: missing #root');

mountApp<Payload>({
  name: 'swsd-mcp/catalog-item-form',
  version: '2.1.0',
  onResult: (data) => {
    if (data) renderForm(root, data, (params) => activeApp?.callServerTool(params));
  },
  onError: ({ message }) => {
    renderError(root, message);
  },
})
  .then((app) => {
    activeApp = app;
  })
  .catch((err) => {
    console.error('catalog-item-form: failed to connect MCP App', err);
  });

/**
 * Module-level reference to the live `App` so the form's submit handler
 * can call back into the server. mountApp resolves to the connected App
 * after the spec-mandated `ui/initialize` handshake; until then the
 * initial render won't have arrived (the host only delivers tool-result
 * after the handshake completes), so the ordering is safe even though
 * this looks racy at first glance.
 */
let activeApp: App | undefined;

/**
 * Submit-callback type. Accepts the same params shape as `App.callServerTool`
 * (verified above). The renderer accepts this as a parameter so the unit
 * tests can drive submit without needing to mock the App class.
 */
export type CallServerTool = (
  params: { name: string; arguments?: Record<string, unknown> },
) => Promise<unknown> | undefined;

/**
 * Render the catalog form into `rootEl`. Pure function over `payload` ->
 * DOM mutations; exported so unit tests can drive it without going through
 * the MCP Apps handshake. The `submit` callback is what would, in
 * production, be a thin wrapper around `app.callServerTool(...)`.
 */
export function renderForm(
  rootEl: HTMLElement,
  payload: Payload,
  submit: CallServerTool,
): void {
  const item = payload.item;
  if (!item || typeof item !== 'object') {
    renderError(rootEl, 'Catalog item payload was missing or malformed.');
    return;
  }

  clear(rootEl);

  const formContainer = el('div', { class: 'catalog-form' });
  rootEl.appendChild(formContainer);

  // Header: the item name so the user knows which form they're filling.
  const itemName =
    typeof item.name === 'string' && item.name.trim().length > 0
      ? item.name.trim()
      : `Catalog item #${String(item.id)}`;
  formContainer.appendChild(
    el('header', undefined, [el('h1', undefined, [itemName])]),
  );

  // Description (HTML, sanitized) -- many catalog items include a
  // multi-line intro paragraph the SWSD portal renders above the form.
  const descriptionHtml =
    typeof item.description === 'string' ? item.description : '';
  if (descriptionHtml.trim().length > 0) {
    const descEl = el('div', { class: 'catalog-description prose' });
    setSanitizedHtml(descEl, descriptionHtml);
    formContainer.appendChild(descEl);
  }

  const variables = Array.isArray(item.variables) ? item.variables : [];
  // Only the variables we know how to render: section-header rows
  // (kind === undefined / null) are dropped from the form. SWSD ships them
  // as field_type 6 (multiline label) and field_type 5 (date legacy
  // variant); both come from older catalog templates and aren't expected
  // on service-request submission per the wire-shape probe at
  // .research/v2/swsd-probes/all_catalog_items.json.
  const renderable = variables.filter((v) => isRenderableKind(v.kind));

  const form = el('form', { class: 'catalog-variable-form', novalidate: true });

  if (renderable.length === 0) {
    form.appendChild(
      el('p', { class: 'empty-variables' }, [
        'This catalog item has no fillable variables.',
      ]),
    );
  } else {
    for (const variable of renderable) {
      form.appendChild(renderField(variable));
    }
  }

  const submitButton = el(
    'button',
    {
      type: 'submit',
      class: 'primary',
      // Disable the button when there are no variables to submit -- the
      // server-side handler accepts an empty request_variables list, but
      // the UX is clearer when we don't offer a no-op action.
      disabled: renderable.length === 0,
    },
    ['Submit request'],
  );

  const status = el('span', {
    class: 'form-status',
    role: 'status',
    'aria-live': 'polite',
  });

  const actions = el('div', { class: 'form-actions' }, [submitButton, status]);
  form.appendChild(actions);
  formContainer.appendChild(form);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleSubmit(item, renderable, form, submitButton, status, submit);
  });
}

/**
 * Returns true for variable kinds the widget can render as form inputs.
 * Anything we can't render (notably `null` / `'null'` / undefined for
 * section headers and SWSD's multi-line label fields) gets filtered before
 * the form is built, so the user doesn't see a half-rendered input.
 */
function isRenderableKind(kind: string | undefined): boolean {
  if (typeof kind !== 'string') return false;
  return ['free_text', 'drop_down_menu', 'multi_select', 'date', 'user'].includes(kind);
}

function renderField(variable: CatalogVariable): HTMLElement {
  const isRequired = variable.required === '1';
  const fieldId = `field-${String(variable.id)}`;
  const labelChildren: Array<Node | string> = [variable.name];
  if (isRequired) {
    labelChildren.push(
      el('span', { class: 'required', 'aria-hidden': 'true' }, ['*']),
    );
  }

  const labelEl = el(
    'label',
    { for: fieldId, ...(isRequired ? { 'aria-required': 'true' } : {}) },
    labelChildren,
  );

  const inputEl = renderInput(variable, fieldId, isRequired);

  const children: Array<Node | string> = [labelEl, inputEl];

  // Help text: SWSD stores it as HTML (`<p>`, `<br>`, etc.). Sanitized via
  // DOMPurify allow-list before render -- same allowlist the comment-thread
  // widget uses.
  const helptext = typeof variable.helptext === 'string' ? variable.helptext : '';
  if (helptext.trim().length > 0) {
    const helpEl = el('div', { class: 'help-text' });
    setSanitizedHtml(helpEl, helptext);
    children.push(helpEl);
  }

  return el('div', { class: 'field' }, children);
}

function renderInput(
  variable: CatalogVariable,
  fieldId: string,
  isRequired: boolean,
): HTMLElement {
  const inputName = `var_${String(variable.id)}`;
  const baseAttrs: Record<string, string | boolean> = {
    id: fieldId,
    name: inputName,
  };
  if (isRequired) baseAttrs.required = true;

  switch (variable.kind) {
    case 'drop_down_menu':
      return renderSelect(variable, baseAttrs, false);
    case 'multi_select':
      return renderSelect(variable, baseAttrs, true);
    case 'date':
      return el('input', { ...baseAttrs, type: 'date' });
    case 'user':
      return el('input', {
        ...baseAttrs,
        type: 'email',
        autocomplete: 'email',
      });
    case 'free_text':
    default:
      return el('input', { ...baseAttrs, type: 'text' });
  }
}

function renderSelect(
  variable: CatalogVariable,
  baseAttrs: Record<string, string | boolean>,
  multiple: boolean,
): HTMLElement {
  const attrs = { ...baseAttrs };
  if (multiple) attrs.multiple = true;
  const select = el('select', attrs);

  // Newline-split -- SWSD docs+probes confirm options are joined with `\n`
  // (sometimes `\r\n` on Windows-authored items). Trim individual options
  // so trailing whitespace doesn't fail an exact-match against the
  // authoritative `options` list on submission.
  const raw = typeof variable.options === 'string' ? variable.options : '';
  const opts = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // For single-select dropdowns with required=false, prepend a blank choice
  // so the user can leave the field genuinely empty. For required dropdowns
  // we omit the blank -- submission will fail HTML5 validation otherwise.
  if (!multiple && variable.required !== '1') {
    select.appendChild(el('option', { value: '' }, ['']));
  }
  for (const option of opts) {
    select.appendChild(el('option', { value: option }, [option]));
  }
  return select;
}

/**
 * Apply pre-sanitized HTML to an element. Centralized so the one place a
 * raw HTML string is written into the DOM is auditable: callers must pass
 * HTML to be rendered through `sanitizeHtml` first (DOMPurify wraps the
 * write).
 */
function setSanitizedHtml(target: HTMLElement, html: string): void {
  // Pre-sanitized via DOMPurify allow-list -- see sanitizeHtml.ts.
  (target as unknown as { innerHTML: string }).innerHTML = sanitizeHtml(html);
}

/**
 * Collect the form values into the wire-shape `request_variables` array,
 * call the server tool, and update the status area with the outcome.
 *
 * Empty values are skipped -- the server treats absent variables as
 * "leave default", which is what the agent likely wants for optional
 * fields.
 */
async function handleSubmit(
  item: CatalogItem,
  variables: CatalogVariable[],
  form: HTMLFormElement,
  submitButton: HTMLButtonElement,
  status: HTMLElement,
  submit: CallServerTool,
): Promise<void> {
  const data = new FormData(form);

  const request_variables: Array<{ custom_field_id: number; value: string }> = [];
  for (const variable of variables) {
    const inputName = `var_${String(variable.id)}`;
    let value: string;
    if (variable.kind === 'multi_select') {
      // FormData.getAll for multi-select returns an entry per selected
      // option. SWSD wants a single comma-joined string per the probes at
      // .research/v2/swsd-probes/post_v7_var_shapes.py -- this matches what
      // the SWSD portal posts.
      const all = data.getAll(inputName).map((v) => String(v));
      value = all.join(', ');
    } else {
      const v = data.get(inputName);
      value = v === null ? '' : String(v);
    }
    if (value.length > 0) {
      request_variables.push({
        custom_field_id: variable.id,
        value,
      });
    }
  }

  // Reset status + lock the button while the request is in flight.
  status.textContent = 'Submitting...';
  status.classList.remove('error', 'success');
  submitButton.disabled = true;

  try {
    const result = await submit({
      name: 'swsd_create_service_request',
      arguments: {
        catalog_item_id: item.id,
        request_variables,
      },
    });

    // CallToolResult shape: { isError?: boolean, content: ContentPart[],
    // structuredContent?: unknown }. Tool-execution errors come back with
    // isError: true; transport errors throw and land in the catch.
    const r = (result ?? {}) as {
      isError?: boolean;
      content?: Array<{ type?: string; text?: string }>;
      structuredContent?: { incident?: { number?: number; id?: number } };
    };

    if (r.isError === true) {
      const errMsg =
        extractTextFromContent(r.content) ?? 'The server reported an error.';
      showStatus(status, errMsg, 'error');
      submitButton.disabled = false;
      return;
    }

    const number = r.structuredContent?.incident?.number;
    const id = r.structuredContent?.incident?.id;
    const refPart =
      number !== undefined
        ? ` (#${String(number)})`
        : id !== undefined
          ? ` (id=${String(id)})`
          : '';
    showStatus(status, `Submitted successfully${refPart}.`, 'success');
    // Disable the button on success: the form represents one request, not a
    // re-submittable form. The widget remains visible so the user can read
    // the confirmation.
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Submission failed unexpectedly.';
    showStatus(status, message, 'error');
    submitButton.disabled = false;
  }
}

function showStatus(
  status: HTMLElement,
  message: string,
  kind: 'error' | 'success',
): void {
  status.textContent = message;
  status.classList.remove('error', 'success');
  status.classList.add(kind);
}

function extractTextFromContent(
  content: Array<{ type?: string; text?: string }> | undefined,
): string | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string' && part.text.length > 0) {
      return part.text;
    }
  }
  return undefined;
}

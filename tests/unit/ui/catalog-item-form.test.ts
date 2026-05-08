// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  renderForm as RenderFormFn,
  CatalogItem,
  CallServerTool,
} from '../../../src/ui/catalog-item-form/index.js';

/**
 * Unit tests for the catalog-item-form widget's render function.
 *
 * The widget's `renderForm` function is exported from
 * `src/ui/catalog-item-form/index.ts` so these tests can drive it without
 * going through the MCP Apps handshake. We import dynamically AFTER ensuring
 * a `#root` element exists so the module's top-level
 * `document.getElementById('root')` succeeds in the jsdom realm.
 *
 * sanitizeHtml depends on a real DOM (DOMPurify uses DOMParser + a template
 * element internally), which is why this file runs under the jsdom env via
 * the directive at the top of the file.
 *
 * Coverage:
 *   - Renders all five plan-spec variable kinds (free_text, drop_down_menu,
 *     multi_select, date, user) with the right input element type
 *   - Required fields marked with * + `required` HTML attribute
 *   - helptext (HTML) is sanitized: <strong> survives, <script> stripped
 *   - Submit collects FormData into the correct request_variables shape
 *     (mocked CallServerTool, asserts exact payload)
 *   - Empty-variables state when item.variables is empty
 */

let renderForm: typeof RenderFormFn;

function ensureRoot(): HTMLElement {
  // Reset DOM between tests by removing any prior root + recreating one.
  // Avoids assigning HTML strings to body which the project's safety hook
  // flags, while keeping each test isolated.
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  const root = document.createElement('main');
  root.id = 'root';
  document.body.appendChild(root);
  return root;
}

beforeEach(async () => {
  ensureRoot();
  if (!renderForm) {
    ({ renderForm } = await import('../../../src/ui/catalog-item-form/index.js'));
  }
});

function getRoot(): HTMLElement {
  const root = document.getElementById('root');
  if (!root) throw new Error('test setup: #root missing');
  return root;
}

const noopSubmit: CallServerTool = () => undefined;

describe('catalog-item-form renderForm -- variable kinds', () => {
  it('renders free_text as text input, drop_down_menu as select, multi_select as multi-select, date as date input, and user as email input', () => {
    const root = getRoot();
    const item: CatalogItem = {
      id: 100,
      name: 'New Hire Onboarding',
      variables: [
        { id: 1, name: 'First name', kind: 'free_text' },
        {
          id: 2,
          name: 'Hardware profile',
          kind: 'drop_down_menu',
          options: 'Administrative\nExecutive\nField',
        },
        {
          id: 3,
          name: 'Mobile devices',
          kind: 'multi_select',
          options: 'Android\niPad\niPhone',
        },
        { id: 4, name: 'Start date', kind: 'date' },
        { id: 5, name: 'Manager email', kind: 'user' },
      ],
    };
    renderForm(root, { item }, noopSubmit);

    const fields = root.querySelectorAll('.field');
    expect(fields).toHaveLength(5);

    const freeText = root.querySelector<HTMLInputElement>('#field-1');
    expect(freeText).not.toBeNull();
    expect(freeText?.tagName).toBe('INPUT');
    expect(freeText?.getAttribute('type')).toBe('text');

    const dropdown = root.querySelector<HTMLSelectElement>('#field-2');
    expect(dropdown).not.toBeNull();
    expect(dropdown?.tagName).toBe('SELECT');
    expect(dropdown?.multiple).toBe(false);
    // Options come from newline-separated `options` field. Optional dropdowns
    // also get a leading blank choice so users can leave the field empty.
    const dropdownValues = Array.from(dropdown?.querySelectorAll('option') ?? []).map(
      (o) => o.getAttribute('value'),
    );
    expect(dropdownValues).toEqual(['', 'Administrative', 'Executive', 'Field']);

    const multi = root.querySelector<HTMLSelectElement>('#field-3');
    expect(multi).not.toBeNull();
    expect(multi?.tagName).toBe('SELECT');
    expect(multi?.multiple).toBe(true);
    const multiValues = Array.from(multi?.querySelectorAll('option') ?? []).map(
      (o) => o.getAttribute('value'),
    );
    expect(multiValues).toEqual(['Android', 'iPad', 'iPhone']);

    const date = root.querySelector<HTMLInputElement>('#field-4');
    expect(date).not.toBeNull();
    expect(date?.tagName).toBe('INPUT');
    expect(date?.getAttribute('type')).toBe('date');

    const user = root.querySelector<HTMLInputElement>('#field-5');
    expect(user).not.toBeNull();
    expect(user?.tagName).toBe('INPUT');
    expect(user?.getAttribute('type')).toBe('email');
  });

  it('renders the catalog item name in the header', () => {
    const root = getRoot();
    renderForm(
      root,
      {
        item: {
          id: 42,
          name: 'New Hire Onboarding',
          variables: [{ id: 1, name: 'First name', kind: 'free_text' }],
        },
      },
      noopSubmit,
    );
    expect(root.querySelector('.catalog-form header h1')?.textContent).toBe(
      'New Hire Onboarding',
    );
  });
});

describe('catalog-item-form renderForm -- required fields', () => {
  it('marks required fields with a * and the HTML required attribute', () => {
    const root = getRoot();
    renderForm(
      root,
      {
        item: {
          id: 1,
          name: 'Test',
          variables: [
            { id: 10, name: 'Mandatory', kind: 'free_text', required: '1' },
            { id: 11, name: 'Optional', kind: 'free_text', required: '0' },
          ],
        },
      },
      noopSubmit,
    );

    const required = root.querySelector<HTMLInputElement>('#field-10');
    expect(required?.hasAttribute('required')).toBe(true);

    const optional = root.querySelector<HTMLInputElement>('#field-11');
    expect(optional?.hasAttribute('required')).toBe(false);

    // Visible asterisk on the required label only.
    const requiredLabel = root.querySelector('label[for="field-10"]');
    expect(requiredLabel?.querySelector('.required')?.textContent).toBe('*');

    const optionalLabel = root.querySelector('label[for="field-11"]');
    expect(optionalLabel?.querySelector('.required')).toBeNull();
  });
});

describe('catalog-item-form renderForm -- helptext sanitization', () => {
  it('passes through allowed HTML (strong, p) and strips disallowed tags (script)', () => {
    const root = getRoot();
    renderForm(
      root,
      {
        item: {
          id: 1,
          name: 'Test',
          variables: [
            {
              id: 20,
              name: 'Field with help',
              kind: 'free_text',
              helptext:
                '<p>Read <strong>carefully</strong>.</p><script>alert(1)</script>',
            },
          ],
        },
      },
      noopSubmit,
    );

    const help = root.querySelector('.help-text');
    expect(help).not.toBeNull();
    // <strong> is in the allowlist and survives.
    expect(help?.querySelector('strong')?.textContent).toBe('carefully');
    // <p> is in the allowlist and survives.
    expect(help?.querySelector('p')).not.toBeNull();
    // <script> is stripped entirely by DOMPurify.
    expect(help?.querySelector('script')).toBeNull();
  });
});

describe('catalog-item-form renderForm -- submit', () => {
  it('collects FormData into a correctly-shaped request_variables array and calls callServerTool', async () => {
    const root = getRoot();
    const submit = vi.fn<CallServerTool>().mockResolvedValue({
      isError: false,
      content: [],
      structuredContent: { incident: { id: 999, number: 12345 } },
    });

    renderForm(
      root,
      {
        item: {
          id: 100,
          name: 'New Hire Onboarding',
          variables: [
            { id: 1, name: 'First name', kind: 'free_text' },
            {
              id: 2,
              name: 'Hardware',
              kind: 'drop_down_menu',
              options: 'Administrative\nExecutive\nField',
            },
            {
              id: 3,
              name: 'Devices',
              kind: 'multi_select',
              options: 'Android\niPad\niPhone',
            },
            { id: 4, name: 'Start date', kind: 'date' },
            // Empty-value field: skipped from the payload.
            { id: 5, name: 'Manager email', kind: 'user' },
          ],
        },
      },
      submit,
    );

    // Fill the form.
    const firstName = root.querySelector<HTMLInputElement>('#field-1');
    if (!firstName) throw new Error('field-1 not rendered');
    firstName.value = 'Alice';

    const hardware = root.querySelector<HTMLSelectElement>('#field-2');
    if (!hardware) throw new Error('field-2 not rendered');
    hardware.value = 'Executive';

    const devices = root.querySelector<HTMLSelectElement>('#field-3');
    if (!devices) throw new Error('field-3 not rendered');
    // Select two options on the multi-select.
    for (const opt of Array.from(devices.options)) {
      if (opt.value === 'iPhone' || opt.value === 'iPad') opt.selected = true;
    }

    const date = root.querySelector<HTMLInputElement>('#field-4');
    if (!date) throw new Error('field-4 not rendered');
    date.value = '2026-06-01';

    // Manager email left empty -- should be skipped from the payload.

    const form = root.querySelector<HTMLFormElement>('form.catalog-variable-form');
    if (!form) throw new Error('form not rendered');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    // Wait for the async submit handler to complete.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(submit).toHaveBeenCalledTimes(1);
    const call = submit.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.name).toBe('swsd_create_service_request');
    const args = call?.arguments as {
      catalog_item_id: number;
      request_variables: Array<{ custom_field_id: number; value: string }>;
    };
    expect(args.catalog_item_id).toBe(100);

    // Multi-select values are joined with ", " for the SWSD wire shape.
    // Empty fields (manager email) are skipped.
    expect(args.request_variables).toEqual([
      { custom_field_id: 1, value: 'Alice' },
      { custom_field_id: 2, value: 'Executive' },
      { custom_field_id: 3, value: 'iPad, iPhone' },
      { custom_field_id: 4, value: '2026-06-01' },
    ]);

    // Status reflects success and includes the new ticket number.
    const status = root.querySelector('.form-status');
    expect(status?.textContent ?? '').toContain('Submitted successfully');
    expect(status?.textContent ?? '').toContain('12345');
    expect(status?.classList.contains('success')).toBe(true);
  });

  it('shows the server error message when callServerTool returns isError: true and re-enables the submit button', async () => {
    const root = getRoot();
    const submit = vi.fn<CallServerTool>().mockResolvedValue({
      isError: true,
      content: [{ type: 'text', text: 'Catalog item is inactive.' }],
    });

    renderForm(
      root,
      {
        item: {
          id: 1,
          name: 'Test',
          variables: [{ id: 1, name: 'Field', kind: 'free_text' }],
        },
      },
      submit,
    );

    const input = root.querySelector<HTMLInputElement>('#field-1');
    if (!input) throw new Error('input not rendered');
    input.value = 'value';

    const form = root.querySelector<HTMLFormElement>('form.catalog-variable-form');
    if (!form) throw new Error('form missing');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const status = root.querySelector('.form-status');
    expect(status?.textContent).toBe('Catalog item is inactive.');
    expect(status?.classList.contains('error')).toBe(true);

    // Submit button is re-enabled so the user can retry.
    const button = root.querySelector<HTMLButtonElement>('button.primary');
    expect(button?.disabled).toBe(false);
  });
});

describe('catalog-item-form renderForm -- empty state', () => {
  it('renders an empty-variables message and a disabled submit button when there are no variables', () => {
    const root = getRoot();
    renderForm(
      root,
      {
        item: {
          id: 1,
          name: 'Empty item',
          variables: [],
        },
      },
      noopSubmit,
    );

    expect(root.querySelector('.empty-variables')?.textContent).toBe(
      'This catalog item has no fillable variables.',
    );
    const button = root.querySelector<HTMLButtonElement>('button.primary');
    expect(button?.disabled).toBe(true);
  });

  it('skips section-header rows (kind: null / undefined) so they do not render as inputs', () => {
    const root = getRoot();
    renderForm(
      root,
      {
        item: {
          id: 1,
          name: 'Mixed',
          variables: [
            { id: 1, name: 'Real field', kind: 'free_text' },
            // SWSD legacy multi-line label rows: kind null, field_type 6.
            { id: 2, name: 'Section header', kind: undefined, field_type: 6 },
          ],
        },
      },
      noopSubmit,
    );

    // Only the real field renders; the section header is filtered out.
    expect(root.querySelectorAll('.field')).toHaveLength(1);
    expect(root.querySelector('#field-1')).not.toBeNull();
    expect(root.querySelector('#field-2')).toBeNull();
  });
});

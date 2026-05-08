// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type {
  renderIncident as RenderIncidentFn,
  isOverdue as IsOverdueFn,
  Incident,
} from '../../../src/ui/incident-detail/index.js';

/**
 * Unit tests for the incident-detail widget's render function.
 *
 * The widget's `renderIncident` function is exported from
 * `src/ui/incident-detail/index.ts` so these tests can drive it without going
 * through the MCP Apps handshake. We import dynamically AFTER ensuring a
 * `#root` element exists so the module's top-level
 * `document.getElementById('root')` succeeds in the jsdom realm.
 *
 * sanitizeHtml depends on a real DOM (DOMPurify uses DOMParser + a template
 * element internally), which is why this file runs under the jsdom env via
 * the directive at the top of the file.
 *
 * Coverage:
 *   - Description: sanitized HTML body (preserves <strong>, strips <script>)
 *   - Overdue badge: shown when due_at is in the past, hidden otherwise
 *   - dd.overdue: applied to the Due row when due_at is in the past
 *   - SLA violations: count badge with singular/plural label
 *   - Resolution: section rendered with sanitized HTML when present, omitted otherwise
 *   - resolution_type: included in the heading when SWSD provides one
 *   - created_at: rendered in the meta dl
 *   - Header: combines #number and name when both are present
 *   - isOverdue helper: parses ISO 8601 strings and compares to now
 */

let renderIncident: typeof RenderIncidentFn;
let isOverdue: typeof IsOverdueFn;

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
  if (!renderIncident) {
    ({ renderIncident, isOverdue } = await import(
      '../../../src/ui/incident-detail/index.js'
    ));
  }
});

function getRoot(): HTMLElement {
  const root = document.getElementById('root');
  if (!root) throw new Error('test setup: #root missing');
  return root;
}

/**
 * Build an incident payload with the always-present `id` plus whatever
 * overrides the test wants. Keeps each test focused on the specific field
 * it exercises.
 */
function inc(overrides: Partial<Incident> = {}): Incident {
  return { id: 12345, name: 'Printer offline', ...overrides };
}

describe('incident-detail renderIncident -- header', () => {
  it('combines #number and name into the header when both are present', () => {
    const root = getRoot();
    renderIncident(root, inc({ number: 42, name: 'Printer offline' }));
    expect(root.querySelector('header h1')?.textContent).toBe(
      '#42 — Printer offline',
    );
  });

  it('falls back to the bare name when number is missing', () => {
    const root = getRoot();
    renderIncident(root, inc({ name: 'Printer offline' }));
    expect(root.querySelector('header h1')?.textContent).toBe('Printer offline');
  });
});

describe('incident-detail renderIncident -- description', () => {
  it('renders sanitized description HTML (preserves <strong>, strips <script>)', () => {
    const root = getRoot();
    renderIncident(
      root,
      inc({
        description:
          '<p>The <strong>printer</strong> is offline.</p><script>alert(1)</script>',
      }),
    );

    const section = root.querySelector('.incident-description');
    expect(section).not.toBeNull();
    expect(section?.querySelector('h2')?.textContent).toBe('Description');

    const body = section?.querySelector('.prose');
    // <strong> is in the sanitizeHtml allowlist and survives.
    expect(body?.querySelector('strong')?.textContent).toBe('printer');
    // <script> is stripped entirely by DOMPurify.
    expect(body?.querySelector('script')).toBeNull();
    // Plain text projection still contains the body text.
    expect(body?.textContent).toContain('printer');
  });

  it('omits the description section when description is absent', () => {
    const root = getRoot();
    renderIncident(root, inc());
    expect(root.querySelector('.incident-description')).toBeNull();
  });
});

describe('incident-detail renderIncident -- overdue handling', () => {
  it('shows the "Overdue" badge when due_at is in the past', () => {
    const root = getRoot();
    // Far in the past so the test isn't sensitive to clock drift.
    renderIncident(root, inc({ due_at: '2000-01-01T00:00:00Z' }));
    const overdueBadge = root.querySelector('.badge-overdue');
    expect(overdueBadge).not.toBeNull();
    expect(overdueBadge?.textContent).toBe('Overdue');
  });

  it('hides the "Overdue" badge when due_at is in the future', () => {
    const root = getRoot();
    // Far in the future so the test isn't sensitive to clock drift.
    renderIncident(root, inc({ due_at: '3000-01-01T00:00:00Z' }));
    expect(root.querySelector('.badge-overdue')).toBeNull();
  });

  it('hides the "Overdue" badge when due_at is absent', () => {
    const root = getRoot();
    renderIncident(root, inc());
    expect(root.querySelector('.badge-overdue')).toBeNull();
  });

  it('applies the .overdue class to the dd of an overdue Due row', () => {
    const root = getRoot();
    renderIncident(root, inc({ due_at: '2000-01-01T00:00:00Z' }));

    // Walk the dl to find the dt labelled "Due" and inspect the matching dd.
    const dts = Array.from(root.querySelectorAll('dl > dt'));
    const dueDt = dts.find((dt) => dt.textContent === 'Due');
    expect(dueDt).toBeDefined();
    const dueDd = dueDt?.nextElementSibling;
    expect(dueDd?.tagName).toBe('DD');
    expect(dueDd?.classList.contains('overdue')).toBe(true);
  });

  it('does not apply the .overdue class when due_at is in the future', () => {
    const root = getRoot();
    renderIncident(root, inc({ due_at: '3000-01-01T00:00:00Z' }));
    const dts = Array.from(root.querySelectorAll('dl > dt'));
    const dueDt = dts.find((dt) => dt.textContent === 'Due');
    const dueDd = dueDt?.nextElementSibling;
    expect(dueDd?.classList.contains('overdue')).toBe(false);
  });
});

describe('incident-detail renderIncident -- SLA violations', () => {
  it('shows the SLA-violation count badge when sla_violations[] has entries', () => {
    const root = getRoot();
    renderIncident(
      root,
      inc({
        sla_violations: [
          { name: 'Time to first response', violation_type: 'response' },
          { name: 'Time to resolution', violation_type: 'resolution' },
        ],
      }),
    );
    const badge = root.querySelector('.badge-sla');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('2 SLA violations');
  });

  it('uses the singular form when sla_violations has exactly one entry', () => {
    const root = getRoot();
    renderIncident(
      root,
      inc({
        sla_violations: [{ name: 'Time to first response', violation_type: 'response' }],
      }),
    );
    expect(root.querySelector('.badge-sla')?.textContent).toBe('1 SLA violation');
  });

  it('hides the SLA badge when sla_violations is an empty array', () => {
    const root = getRoot();
    renderIncident(root, inc({ sla_violations: [] }));
    expect(root.querySelector('.badge-sla')).toBeNull();
  });

  it('hides the SLA badge when sla_violations is absent', () => {
    const root = getRoot();
    renderIncident(root, inc());
    expect(root.querySelector('.badge-sla')).toBeNull();
  });
});

describe('incident-detail renderIncident -- resolution', () => {
  it('renders the resolution section when resolution is present', () => {
    const root = getRoot();
    renderIncident(
      root,
      inc({
        resolution: '<p>Replaced toner cartridge.</p>',
        resolution_type: 'Resolved by IT',
      }),
    );

    const section = root.querySelector('.incident-resolution');
    expect(section).not.toBeNull();
    // Heading combines the static label with the resolution_type.
    expect(section?.querySelector('h2')?.textContent).toBe(
      'Resolution — Resolved by IT',
    );
    // Body is sanitized HTML.
    const body = section?.querySelector('.prose');
    expect(body?.querySelector('p')?.textContent).toBe('Replaced toner cartridge.');
  });

  it('uses the bare "Resolution" heading when resolution_type is absent', () => {
    const root = getRoot();
    renderIncident(root, inc({ resolution: '<p>Closed.</p>' }));
    expect(
      root.querySelector('.incident-resolution h2')?.textContent,
    ).toBe('Resolution');
  });

  it('omits the resolution section when resolution is absent', () => {
    const root = getRoot();
    renderIncident(root, inc({ resolution_type: 'Resolved by IT' }));
    expect(root.querySelector('.incident-resolution')).toBeNull();
  });

  it('strips disallowed tags from the resolution body', () => {
    const root = getRoot();
    renderIncident(
      root,
      inc({
        resolution:
          '<p>Done</p><script>alert(2)</script><a href="javascript:bad()">x</a>',
      }),
    );
    const body = root.querySelector('.incident-resolution .prose');
    expect(body?.querySelector('script')).toBeNull();
    const link = body?.querySelector('a');
    if (link) {
      const href = link.getAttribute('href');
      if (href !== null) {
        expect(href).not.toMatch(/javascript:/i);
      }
    }
  });
});

describe('incident-detail renderIncident -- created_at', () => {
  it('renders Created in the meta dl when created_at is present', () => {
    const root = getRoot();
    renderIncident(root, inc({ created_at: '2026-05-01T12:00:00Z' }));

    const dts = Array.from(root.querySelectorAll('dl > dt'));
    const createdDt = dts.find((dt) => dt.textContent === 'Created');
    expect(createdDt).toBeDefined();
    const createdDd = createdDt?.nextElementSibling;
    expect(createdDd?.tagName).toBe('DD');
    // Locale string formatting varies by environment; just assert the dd is
    // populated (formatDate fallbacks to the raw input only when parsing
    // fails — the string is parseable here, so it'll be a locale string).
    expect(createdDd?.textContent ?? '').not.toBe('');
  });

  it('omits Created from the meta dl when created_at is absent', () => {
    const root = getRoot();
    renderIncident(root, inc());
    const dts = Array.from(root.querySelectorAll('dl > dt'));
    expect(dts.find((dt) => dt.textContent === 'Created')).toBeUndefined();
  });
});

describe('isOverdue helper', () => {
  it('returns true for a date in the past', () => {
    expect(isOverdue('2000-01-01T00:00:00Z')).toBe(true);
  });

  it('returns false for a date in the future', () => {
    expect(isOverdue('3000-01-01T00:00:00Z')).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(isOverdue(undefined)).toBe(false);
  });

  it('returns false for empty-string input', () => {
    expect(isOverdue('')).toBe(false);
  });

  it('returns false for unparseable strings', () => {
    expect(isOverdue('not-a-date')).toBe(false);
  });
});

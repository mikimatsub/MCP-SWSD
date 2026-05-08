// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { renderTimeline as RenderTimelineFn } from '../../../src/ui/audit-timeline/index.js';

/**
 * Unit tests for the audit-timeline widget's render function.
 *
 * The widget's `renderTimeline` function is exported from
 * `src/ui/audit-timeline/index.ts` so these tests can drive it without going
 * through the MCP Apps handshake. We import dynamically AFTER ensuring a
 * `#root` element exists so the module's top-level
 * `document.getElementById('root')` succeeds in the jsdom realm.
 *
 * Coverage:
 *   - Empty state ("No history recorded for this record.")
 *   - Single audit entry renders icon + chip + timestamp + user + field
 *   - Multiple entries render in payload order
 *   - Day grouping: entries on different days get separate `.day-group` blocks
 *   - Old -> New value rendering when both are present
 *   - Action icon glyph matches action kind (created/updated/deleted)
 */

let renderTimeline: typeof RenderTimelineFn;

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
  // Re-import per-test is unnecessary — the module's top-level
  // `mountApp(...).catch(...)` is fired once on first import; in jsdom there
  // is no parent window so `connect()` rejects, but the catch swallows the
  // error. The exported `renderTimeline` is what we exercise.
  if (!renderTimeline) {
    ({ renderTimeline } = await import('../../../src/ui/audit-timeline/index.js'));
  }
});

function getRoot(): HTMLElement {
  const root = document.getElementById('root');
  if (!root) throw new Error('test setup: #root missing');
  return root;
}

describe('audit-timeline renderTimeline — empty state', () => {
  it('renders the empty-state message when audits is an empty array', () => {
    const root = getRoot();
    renderTimeline(root, { audits: [] });
    expect(root.querySelector('.empty-state')?.textContent).toBe(
      'No history recorded for this record.',
    );
    expect(root.querySelectorAll('.audit-entry')).toHaveLength(0);
  });

  it('renders a header with the audit count', () => {
    const root = getRoot();
    renderTimeline(root, { audits: [] });
    expect(root.querySelector('.timeline-header h1')?.textContent).toBe(
      'Audit history (0)',
    );
  });
});

describe('audit-timeline renderTimeline — single entry', () => {
  it('renders icon, action chip, timestamp, user, field, and uuid key', () => {
    const root = getRoot();
    renderTimeline(root, {
      audits: [
        {
          uuid: 'aud-uuid-1',
          message: 'State changed from New to Assigned',
          action: 'Update',
          created_at: '2026-05-08T10:30:00Z',
          user: 'Alice Example',
        },
      ],
    });

    const entry = root.querySelector('.audit-entry');
    expect(entry).not.toBeNull();
    // uuid lives on the data attribute, per `verified_swsd_api_quirks.md`.
    expect(entry?.getAttribute('data-audit-uuid')).toBe('aud-uuid-1');

    // The action chip renders the raw action label.
    expect(root.querySelector('.badge')?.textContent).toBe('Update');
    // Icon and badge share the kind class — Update -> updated.
    expect(root.querySelector('.audit-icon-updated')).not.toBeNull();
    expect(root.querySelector('.badge-updated')).not.toBeNull();

    // The parsed field name shows up in the header.
    expect(root.querySelector('.audit-field')?.textContent).toBe('State');

    // User attribution prefixes the name with "by ".
    expect(root.querySelector('.audit-user')?.textContent).toBe('by Alice Example');

    // Timestamp is rendered as a locale string — assert presence (locale
    // output varies by environment).
    const time = root.querySelector('.audit-time');
    expect(time?.textContent ?? '').not.toBe('');
  });
});

describe('audit-timeline renderTimeline — multiple entries', () => {
  it('renders entries in payload order', () => {
    const root = getRoot();
    renderTimeline(root, {
      audits: [
        {
          uuid: 'aud-1',
          message: 'Priority changed from Low to High',
          action: 'Update',
          created_at: '2026-05-08T10:00:00Z',
          user: 'Alice',
        },
        {
          uuid: 'aud-2',
          message: 'State changed from New to Assigned',
          action: 'Update',
          created_at: '2026-05-08T11:00:00Z',
          user: 'Bob',
        },
        {
          uuid: 'aud-3',
          message: 'Assignee changed from John to Jane',
          action: 'Update',
          created_at: '2026-05-08T12:00:00Z',
          user: 'Carol',
        },
      ],
    });

    const entries = Array.from(
      root.querySelectorAll<HTMLElement>('.audit-entry'),
    );
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.getAttribute('data-audit-uuid'))).toEqual([
      'aud-1',
      'aud-2',
      'aud-3',
    ]);
    const fields = entries.map(
      (e) => e.querySelector('.audit-field')?.textContent ?? '',
    );
    expect(fields).toEqual(['Priority', 'State', 'Assignee']);
  });
});

describe('audit-timeline renderTimeline — day grouping', () => {
  it('puts entries on different days in separate .day-group blocks', () => {
    const root = getRoot();
    // Use clearly different days that any locale will bucket apart.
    renderTimeline(root, {
      audits: [
        {
          uuid: 'aud-1',
          message: 'State changed from New to Assigned',
          action: 'Update',
          created_at: '2026-05-07T15:00:00Z',
          user: 'Alice',
        },
        {
          uuid: 'aud-2',
          message: 'Priority changed from Low to High',
          action: 'Update',
          created_at: '2026-05-07T16:00:00Z',
          user: 'Alice',
        },
        {
          uuid: 'aud-3',
          message: 'Assignee changed from John to Jane',
          action: 'Update',
          created_at: '2026-05-09T10:00:00Z',
          user: 'Bob',
        },
      ],
    });

    const groups = root.querySelectorAll('.day-group');
    expect(groups).toHaveLength(2);
    // First group has 2 entries, second has 1.
    expect(groups[0]?.querySelectorAll('.audit-entry')).toHaveLength(2);
    expect(groups[1]?.querySelectorAll('.audit-entry')).toHaveLength(1);
    // Each group has a date header.
    expect(groups[0]?.querySelector('h2')?.textContent ?? '').not.toBe('');
    expect(groups[1]?.querySelector('h2')?.textContent ?? '').not.toBe('');
  });
});

describe('audit-timeline renderTimeline — old -> new diff', () => {
  it('renders both old and new values inside <code> elements', () => {
    const root = getRoot();
    renderTimeline(root, {
      audits: [
        {
          uuid: 'aud-1',
          message: 'State changed from New to On Hold',
          action: 'Update',
          created_at: '2026-05-08T10:00:00Z',
          user: 'Alice',
        },
      ],
    });

    const diff = root.querySelector('.audit-diff');
    expect(diff).not.toBeNull();
    const codes = Array.from(diff?.querySelectorAll('code') ?? []);
    expect(codes).toHaveLength(2);
    expect(codes[0]?.textContent).toBe('New');
    expect(codes[1]?.textContent).toBe('On Hold');
    // Arrow separator is present.
    expect(diff?.querySelector('.audit-diff-arrow')).not.toBeNull();
  });

  it('falls back to the raw message when the diff pattern does not match', () => {
    const root = getRoot();
    renderTimeline(root, {
      audits: [
        {
          uuid: 'aud-1',
          message: 'Comment was added',
          action: 'Create',
          created_at: '2026-05-08T10:00:00Z',
          user: 'Alice',
        },
      ],
    });

    expect(root.querySelector('.audit-diff')).toBeNull();
    expect(root.querySelector('.audit-message')?.textContent).toBe('Comment was added');
  });
});

describe('audit-timeline renderTimeline — action icon mapping', () => {
  it('maps Create/Add to the created kind (triangle glyph)', () => {
    const root = getRoot();
    renderTimeline(root, {
      audits: [
        {
          uuid: 'aud-1',
          message: 'Record created',
          action: 'Create',
          created_at: '2026-05-08T10:00:00Z',
          user: 'Alice',
        },
      ],
    });
    const icon = root.querySelector('.audit-icon');
    expect(icon?.classList.contains('audit-icon-created')).toBe(true);
    expect(icon?.textContent).toBe('▶');
    expect(root.querySelector('.badge-created')).not.toBeNull();
  });

  it('maps Update to the updated kind (pencil glyph)', () => {
    const root = getRoot();
    renderTimeline(root, {
      audits: [
        {
          uuid: 'aud-1',
          message: 'State changed from New to Assigned',
          action: 'Update',
          created_at: '2026-05-08T10:00:00Z',
          user: 'Alice',
        },
      ],
    });
    const icon = root.querySelector('.audit-icon');
    expect(icon?.classList.contains('audit-icon-updated')).toBe(true);
    expect(icon?.textContent).toBe('✎');
  });

  it('maps Delete/Remove to the deleted kind (X glyph)', () => {
    const root = getRoot();
    renderTimeline(root, {
      audits: [
        {
          uuid: 'aud-1',
          message: 'Attachment was removed',
          action: 'Delete',
          created_at: '2026-05-08T10:00:00Z',
          user: 'Alice',
        },
      ],
    });
    const icon = root.querySelector('.audit-icon');
    expect(icon?.classList.contains('audit-icon-deleted')).toBe(true);
    expect(icon?.textContent).toBe('✕');
    expect(root.querySelector('.badge-deleted')).not.toBeNull();
  });
});

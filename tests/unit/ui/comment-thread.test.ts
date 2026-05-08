// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { renderThread as RenderThreadFn } from '../../../src/ui/comment-thread/index.js';

/**
 * Unit tests for the comment-thread widget's render function.
 *
 * The widget's `renderThread` function is exported from
 * `src/ui/comment-thread/index.ts` so these tests can drive it without going
 * through the MCP Apps handshake. We import dynamically AFTER ensuring a
 * `#root` element exists so the module's top-level
 * `document.getElementById('root')` succeeds in the jsdom realm.
 *
 * sanitizeHtml depends on a real DOM (DOMPurify uses DOMParser + a template
 * element internally), which is why this file runs under the jsdom env via
 * the directive at the top of the file.
 *
 * Coverage:
 *   - Empty state ("No comments yet on this ticket.")
 *   - Single comment renders author, sanitized body, timestamp
 *   - Multiple comments render in payload order
 *   - Private comment shows the Private badge and gets the private class
 *   - Sanitization regression: `<script>` in a body is stripped
 */

let renderThread: typeof RenderThreadFn;

function ensureRoot(): HTMLElement {
  // Reset DOM between tests by removing any prior root + recreating one.
  // Avoids `document.body.innerHTML = ...` (which the project's safety hook
  // flags) while keeping each test isolated.
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
  // error. The exported `renderThread` is what we exercise.
  if (!renderThread) {
    ({ renderThread } = await import('../../../src/ui/comment-thread/index.js'));
  }
});

function getRoot(): HTMLElement {
  const root = document.getElementById('root');
  if (!root) throw new Error('test setup: #root missing');
  return root;
}

describe('comment-thread renderThread — empty state', () => {
  it('renders the empty-state message when comments is an empty array', () => {
    const root = getRoot();
    renderThread(root, { comments: [] });
    expect(root.querySelector('.empty-state')?.textContent).toBe(
      'No comments yet on this ticket.',
    );
    expect(root.querySelectorAll('.comment')).toHaveLength(0);
  });

  it('renders a header with comment count when incident_id is provided', () => {
    const root = getRoot();
    renderThread(root, { comments: [], incident_id: 12345 });
    expect(root.querySelector('.thread-header h1')?.textContent).toBe(
      'Comments on incident #12345 (0)',
    );
  });
});

describe('comment-thread renderThread — single comment', () => {
  it('renders author name, sanitized body, and timestamp', () => {
    const root = getRoot();
    renderThread(root, {
      comments: [
        {
          id: 1,
          body: '<p>Hello <strong>world</strong></p>',
          is_private: false,
          author_name: 'Alice Example',
          author_email: 'alice@example.com',
          created_at: '2026-01-15T10:30:00Z',
        },
      ],
      incident_id: 42,
    });

    const comment = root.querySelector('.comment');
    expect(comment).not.toBeNull();

    expect(root.querySelector('.comment-author')?.textContent).toBe('Alice Example');

    const content = root.querySelector('.comment-content');
    // Sanitized body: <p> and <strong> are in the allow-list and survive.
    expect(content?.textContent).toContain('Hello');
    expect(content?.querySelector('strong')?.textContent).toBe('world');

    // Timestamp is rendered as a locale string — we only assert presence
    // (locale string output varies by environment; the formatter just has to
    // produce *something* derived from the ISO input).
    const time = root.querySelector('.comment-time');
    expect(time?.textContent ?? '').not.toBe('');

    // Avatar shows initials derived from the author name.
    expect(root.querySelector('.comment-avatar')?.textContent).toBe('AE');

    // Public comment — no private badge, no private class.
    expect(root.querySelector('.badge-private')).toBeNull();
    expect(comment?.classList.contains('comment-private')).toBe(false);
  });
});

describe('comment-thread renderThread — multiple comments', () => {
  it('renders comments in the payload order', () => {
    const root = getRoot();
    renderThread(root, {
      comments: [
        {
          id: 1,
          body: '<p>First</p>',
          is_private: false,
          author_name: 'Alice',
        },
        {
          id: 2,
          body: '<p>Second</p>',
          is_private: false,
          author_name: 'Bob',
        },
        {
          id: 3,
          body: '<p>Third</p>',
          is_private: false,
          author_name: 'Carol',
        },
      ],
    });

    const authors = Array.from(root.querySelectorAll('.comment-author')).map(
      (el) => el.textContent,
    );
    expect(authors).toEqual(['Alice', 'Bob', 'Carol']);
  });
});

describe('comment-thread renderThread — private comments', () => {
  it('shows a "Private" badge and applies the comment-private class', () => {
    const root = getRoot();
    renderThread(root, {
      comments: [
        {
          id: 1,
          body: '<p>Internal note</p>',
          is_private: true,
          author_name: 'Triager',
        },
      ],
    });

    const comment = root.querySelector('.comment');
    expect(comment?.classList.contains('comment-private')).toBe(true);

    const badge = root.querySelector('.badge-private');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('Private');
  });

  it('does not render a Private badge on public comments', () => {
    const root = getRoot();
    renderThread(root, {
      comments: [
        {
          id: 2,
          body: '<p>Public update</p>',
          is_private: false,
          author_name: 'User',
        },
      ],
    });
    expect(root.querySelector('.badge-private')).toBeNull();
  });
});

describe('comment-thread renderThread — sanitization', () => {
  it('strips <script> and inline event handlers from comment bodies', () => {
    const root = getRoot();
    renderThread(root, {
      comments: [
        {
          id: 1,
          body:
            '<p>safe</p><script>alert(1)</script><a href="javascript:bad()" onclick="x()">link</a>',
          is_private: false,
          author_name: 'Attacker',
        },
      ],
    });

    const content = root.querySelector('.comment-content');
    expect(content?.querySelector('p')?.textContent).toBe('safe');
    // <script> tag stripped entirely
    expect(content?.querySelector('script')).toBeNull();
    // The <a> remains, but the javascript: href + onclick handler are gone.
    // DOMPurify drops the entire `href` attribute when its URL scheme is
    // disallowed, so `getAttribute('href')` returns null in that case — we
    // assert "no javascript: URL anywhere on this anchor".
    const link = content?.querySelector('a');
    expect(link).not.toBeNull();
    const href = link?.getAttribute('href');
    if (href !== null && href !== undefined) {
      expect(href).not.toMatch(/javascript:/i);
    }
    expect(link?.hasAttribute('onclick')).toBe(false);
  });
});

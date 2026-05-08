// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../../src/ui/shared/sanitizeHtml.js';

/**
 * sanitizeHtml is a thin wrapper around DOMPurify with a project-specific
 * allow-list and an `afterSanitizeAttributes` hook that forces every <a>
 * to open in a new tab with `rel="noopener noreferrer"`.
 *
 * DOMPurify needs a real DOM (it uses DOMParser + a template element to
 * build the sanitized tree), so this test file runs under the jsdom
 * vitest environment via the directive at the top — the rest of the
 * UI test suite stays in the cheaper node env.
 *
 * Each test exercises one allow-list rule. If the suite drifts (e.g.
 * SWSD adds a new tag we want to allow), update the allow-list in
 * `src/ui/shared/sanitizeHtml.ts` and add a regression test here.
 */
describe('sanitizeHtml', () => {
  it('preserves safe formatting tags', () => {
    const html = '<p>Hello <strong>world</strong></p><ul><li>one</li></ul><h2>Heading</h2>';
    const out = sanitizeHtml(html);
    expect(out).toContain('<p>');
    expect(out).toContain('<strong>');
    expect(out).toContain('<ul>');
    expect(out).toContain('<h2>');
  });

  it('strips script tags entirely', () => {
    const html = 'before<script>danger</script>after';
    expect(sanitizeHtml(html)).not.toContain('<script>');
    expect(sanitizeHtml(html)).not.toContain('danger');
  });

  it('strips style and iframe', () => {
    expect(sanitizeHtml('<style>body{display:none}</style>x')).not.toContain('<style');
    expect(sanitizeHtml('<iframe src="evil"></iframe>')).not.toContain('<iframe');
  });

  it('strips inline event handlers', () => {
    const html = '<a href="https://example.com" onclick="danger()">click</a>';
    const out = sanitizeHtml(html);
    expect(out).toContain('href="https://example.com"');
    expect(out).not.toContain('onclick');
  });

  it('forces noopener noreferrer on external links', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(out).toMatch(/rel="[^"]*noreferrer[^"]*"/);
  });

  it('strips javascript: URLs', () => {
    expect(sanitizeHtml('<a href="javascript:danger()">x</a>')).not.toContain('javascript:');
  });

  it('allows data:image but strips data:text/html', () => {
    expect(sanitizeHtml('<a href="data:text/html,<script>danger</script>">x</a>')).not.toContain(
      'data:text',
    );
    expect(sanitizeHtml('<img src="data:image/png;base64,abc" />')).toContain('data:image/png');
  });
});

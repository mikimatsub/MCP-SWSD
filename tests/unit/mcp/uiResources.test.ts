import { describe, it, expect, beforeEach } from 'vitest';
import { loadUiResource, _resetCacheForTests } from '../../../src/mcp/uiResources.js';

describe('loadUiResource', () => {
  beforeEach(() => _resetCacheForTests());

  it('reads a UI bundle from dist/ui/<name>.html and caches it', () => {
    // dist/ui/_smoke.html is produced by `npm run build:ui` (run before tests in CI).
    const html = loadUiResource('_smoke');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('SWSD UI Smoke');
  });

  it('throws a clear error when the bundle is missing', () => {
    expect(() => loadUiResource('does-not-exist')).toThrow(
      /UI resource "does-not-exist" not found/,
    );
  });

  it('caches reads (second call returns the same string reference)', () => {
    const a = loadUiResource('_smoke');
    const b = loadUiResource('_smoke');
    expect(a).toBe(b);
  });
});

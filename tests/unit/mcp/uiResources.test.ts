import { describe, it, expect, beforeEach } from 'vitest';
import { loadUiResource, _resetCacheForTests } from '../../../src/mcp/uiResources.js';

describe('loadUiResource', () => {
  beforeEach(() => _resetCacheForTests());

  it('reads a UI bundle from dist/ui/<name>.html and caches it', () => {
    // dist/ui/incident-detail.html is produced by `npm run build:ui` (run before tests in CI).
    const html = loadUiResource('incident-detail');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('SWSD Incident');
  });

  it('throws a clear error when the bundle is missing', () => {
    expect(() => loadUiResource('does-not-exist')).toThrow(
      /UI resource "does-not-exist" not found/,
    );
  });

  it('caches reads (second call returns the same string reference)', () => {
    const a = loadUiResource('incident-detail');
    const b = loadUiResource('incident-detail');
    expect(a).toBe(b);
  });
});

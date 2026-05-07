import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const distUi = resolve(process.cwd(), 'dist', 'ui');

describe('UI build artifacts', () => {
  it('emits a single-file _smoke.html bundle under dist/ui/', () => {
    const path = resolve(distUi, '_smoke.html');
    expect(existsSync(path)).toBe(true);
    const html = readFileSync(path, 'utf8');
    expect(html).toContain('SWSD UI Smoke');
    // vite-plugin-singlefile inlines all <script>/<link> assets — no external src should remain.
    expect(html).not.toMatch(/<script[^>]+src=["']\/[^"']+["']/);
    expect(html).not.toMatch(/<link[^>]+href=["']\/[^"']+\.css["']/);
  });

  it('produces a bundle under the 200 KB single-tool budget', () => {
    const path = resolve(distUi, '_smoke.html');
    const bytes = statSync(path).size;
    expect(bytes).toBeLessThan(200_000);
  });
});

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const distUi = resolve(process.cwd(), 'dist', 'ui');

/**
 * Sentinel substring expected in each bundled HTML — picked to match the
 * `<title>` of each UI's index.html. If a bundle is empty / shells out to a
 * placeholder we want to know.
 */
const BUNDLES: Array<{ name: string; sentinel: string }> = [
  { name: 'incident-detail', sentinel: 'SWSD Incident' },
  { name: 'solution-detail', sentinel: 'SWSD Solution' },
  { name: 'incident-list', sentinel: 'SWSD Incidents' },
  { name: 'custom-fields', sentinel: 'SWSD Custom Fields' },
];

describe('UI build artifacts', () => {
  for (const { name, sentinel } of BUNDLES) {
    it(`emits a single-file ${name}.html bundle under dist/ui/`, () => {
      const path = resolve(distUi, `${name}.html`);
      expect(existsSync(path)).toBe(true);
      const html = readFileSync(path, 'utf8');
      expect(html).toContain(sentinel);
      // vite-plugin-singlefile inlines all <script>/<link> assets — no external src should remain.
      expect(html).not.toMatch(/<script[^>]+src=["']\/[^"']+["']/);
      expect(html).not.toMatch(/<link[^>]+href=["']\/[^"']+\.css["']/);
    });

    it(`${name}.html stays under the 200 KB single-tool budget`, () => {
      const path = resolve(distUi, `${name}.html`);
      const bytes = statSync(path).size;
      expect(bytes).toBeLessThan(200_000);
    });
  }
});

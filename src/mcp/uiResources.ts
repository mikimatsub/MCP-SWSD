import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// At runtime: this file is `dist/mcp/uiResources.js`, so the sibling `ui` dir
// under `dist/` is at `<__dirname>/../ui`. That's the production path.
// At test time (vitest evaluates the .ts source directly), `__dirname` points
// to `src/mcp/`, where the sibling `ui` dir contains source — not the built
// HTML — so we also try `<process.cwd()>/dist/ui` as a fallback (tests run
// from the repo root after `npm run build:ui`).
const RUNTIME_UI_DIR = resolve(__dirname, '..', 'ui');
const FALLBACK_UI_DIR = resolve(process.cwd(), 'dist', 'ui');

const cache = new Map<string, string>();

/**
 * Loads an inlined UI bundle produced by `npm run build:ui`.
 *
 * @param name - Bundle slug WITHOUT the `.html` extension (e.g. `_smoke`,
 *   `incident-detail`). Mirrors the entry name in `vite.config.ts` UI_TOOLS.
 * @returns The full inlined HTML string ready to ship as an MCP resource —
 *   `vite-plugin-singlefile` has already inlined every `<script>` and `<link>`.
 * @throws If the bundle file is missing, with a build-hint message pointing
 *   at `npm run build:ui`.
 *
 * Reads are cached for the process lifetime; the file is read from disk only
 * the first time a given `name` is requested.
 */
export function loadUiResource(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const candidates = [
    resolve(RUNTIME_UI_DIR, `${name}.html`),
    resolve(FALLBACK_UI_DIR, `${name}.html`),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) {
    throw new Error(
      `UI resource "${name}" not found at ${candidates.join(' or ')}. Did you run "npm run build:ui"?`,
    );
  }
  const html = readFileSync(path, 'utf8');
  cache.set(name, html);
  return html;
}

/** Internal — leading underscore signals not-public-API; used only by uiResources tests to reset state between cases. */
export function _resetCacheForTests(): void {
  cache.clear();
}

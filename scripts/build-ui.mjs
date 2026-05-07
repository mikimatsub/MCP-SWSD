// Drives a separate Vite build per UI entry.
//
// Why not a single multi-input Vite build? `vite-plugin-singlefile` enables
// `output.inlineDynamicImports: true` (on Vite ≤ 7) so every chunk lands in
// the same HTML. Rollup forbids that flag with multiple inputs, so each tool
// has to be its own build invocation. We collect the entry list in
// `UI_TOOLS` here (mirrors `vite.config.ts`) and loop. Each invocation reads
// the same `vite.config.ts`; we feed the active entry via the UI_ENTRY env
// var which the config picks up.
//
// Order matters slightly: `emptyOutDir: true` would clear `dist/ui` between
// runs, so we set it for the first entry only.

import { build } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Mirrors the list in vite.config.ts. Update both when adding a UI.
const UI_TOOLS = ['_smoke', 'incident-detail'];

let first = true;
for (const name of UI_TOOLS) {
  process.env.UI_ENTRY = name;
  await build({
    configFile: resolve(repoRoot, 'vite.config.ts'),
    build: { emptyOutDir: first },
  });
  first = false;
}

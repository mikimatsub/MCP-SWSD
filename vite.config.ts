import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

const UI_TOOLS = ['_smoke'];

/**
 * Flattens Vite's default multi-page HTML output (`<input-relative-path>/index.html`)
 * to `<entry-name>.html` at the outDir root. This keeps `dist/ui/<name>.html`
 * predictable for `loadUiResource(name)` while letting Rollup name JS chunks
 * however it wants — the singlefile plugin's classifier picks the right HTML
 * asset because `_smoke.html` (a chunk) is no longer in the bundle.
 */
function flattenHtmlOutput(): Plugin {
  return {
    name: 'flatten-html-output',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [oldKey, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !oldKey.endsWith('/index.html')) continue;
        // Match `<...>/<name>/index.html` and flatten to `<name>.html` at root.
        const match = oldKey.match(/(?:^|\/)([^/]+)\/index\.html$/);
        if (!match) continue;
        const entryName = match[1];
        const newKey = `${entryName}.html`;
        delete bundle[oldKey];
        asset.fileName = newKey;
        bundle[newKey] = asset;
      }
    },
  };
}

export default defineConfig({
  plugins: [viteSingleFile(), flattenHtmlOutput()],
  build: {
    outDir: resolve(__dirname, 'dist', 'ui'),
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        UI_TOOLS.map((name) => [name, resolve(__dirname, 'src', 'ui', name, 'index.html')]),
      ),
    },
  },
});

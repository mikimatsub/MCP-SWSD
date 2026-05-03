#!/usr/bin/env node
/**
 * Dump the SWSD tenant's full custom-field schema to a local JSON fixture.
 *
 * Usage:
 *   SWSD_TOKEN="..." SWSD_BASE_URL="https://api.samanage.com" \
 *     npm run dump:custom-fields [-- --out=path/to/file.json]
 *
 * The output captures every custom field's complete metadata. Useful for:
 *   - Documenting the tenant's schema for future reference
 *   - Generating test fixtures for offline development
 *   - Diffing schema changes over time (commit the file in your private
 *     internal fork; do NOT commit it to a public repo without scrubbing)
 *
 * The default output path is `./validation/custom-fields.json`, which is
 * gitignored. Override with `--out=<path>`.
 *
 * Implementation note: SWSD's /custom_fields.json silently ignores per_page
 * and returns the entire collection in one response. We fetch once and write.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = resolve(REPO_ROOT, 'validation/custom-fields.json');

interface Args {
  out: string;
}

function parseArgs(argv: string[]): Args {
  let out = DEFAULT_OUT;
  for (const a of argv) {
    if (a.startsWith('--out=')) out = resolve(a.slice('--out='.length));
  }
  return { out };
}

async function main(): Promise<void> {
  const token = process.env.SWSD_TOKEN;
  const baseUrl = (process.env.SWSD_BASE_URL ?? 'https://api.samanage.com').replace(/\/+$/, '');
  if (!token) {
    process.stderr.write('SWSD_TOKEN environment variable is required.\n');
    process.exit(2);
  }

  const args = parseArgs(process.argv.slice(2));
  const headers = {
    'X-Samanage-Authorization': `Bearer ${token}`,
    Accept: 'application/vnd.samanage.v2.1+json',
  };

  process.stderr.write('Fetching custom fields...\n');
  const url = `${baseUrl}/custom_fields.json?per_page=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    process.stderr.write(`HTTP ${String(res.status)} from ${url}\n`);
    const body = await res.text().catch(() => '');
    process.stderr.write(body.slice(0, 500) + '\n');
    process.exit(1);
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    process.stderr.write('Unexpected response shape — expected array.\n');
    process.exit(1);
  }

  mkdirSync(dirname(args.out), { recursive: true });
  const captured = {
    captured_at: new Date().toISOString(),
    base_url: baseUrl,
    field_count: body.length,
    fields: body,
  };
  writeFileSync(args.out, JSON.stringify(captured, null, 2), 'utf-8');
  process.stdout.write(`Wrote ${String(body.length)} custom fields to ${args.out}\n`);
  process.stdout.write(
    `\nNOTE: this file contains your tenant's account_id and field names.\n` +
      `It is gitignored by default (validation/). Do NOT commit to a public\n` +
      `repo without reviewing/scrubbing first.\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

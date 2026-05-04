/**
 * Documentation contract tests for .env.example.
 *
 * Asserts that .env.example documents every environment variable the
 * server actually reads, and that the example values match the schema
 * defaults. Catches the common "added a new env var, forgot to
 * document it" bug.
 *
 * If a test in this file fails:
 *   1. Schema gained a new field — add a documented line to .env.example.
 *   2. Schema removed a field — remove the corresponding .env.example line.
 *   3. Default value changed — update .env.example to match.
 * Never edit the test to make it pass.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EnvSchema } from '../../../src/config/env.js';

const ENV_EXAMPLE = readFileSync(resolve('.env.example'), 'utf-8');

/**
 * Extracts `KEY=value` lines from .env.example. Comments and blank
 * lines are ignored. Trailing comments after the value are stripped.
 */
function parseEnvExample(content: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out.set(key, value);
  }
  return out;
}

const documented = parseEnvExample(ENV_EXAMPLE);
const schemaKeys = new Set(Object.keys(EnvSchema.shape));
const defaults = EnvSchema.parse({}) as Record<string, unknown>;

describe('.env.example documentation contract', () => {
  describe('Coverage', () => {
    for (const key of schemaKeys) {
      it(`documents ${key}`, () => {
        expect(
          documented.has(key),
          `${key} is in EnvSchema but missing from .env.example. Add a line documenting its purpose and default.`,
        ).toBe(true);
      });
    }

    it('does not document any keys the server does not read', () => {
      const orphans = [...documented.keys()].filter((k) => !schemaKeys.has(k));
      expect(
        orphans,
        `.env.example documents these keys but EnvSchema does not declare them: ${orphans.join(', ')}`,
      ).toEqual([]);
    });
  });

  describe('Default values', () => {
    /**
     * Skip rules:
     * - SWSD_TOKEN: no schema default (intentionally empty in .env.example for users to fill in)
     * - SWSD_ENABLE_EXTRAS / SWSD_ALLOWED_ORIGINS: CSV transforms parse [] from empty;
     *   .env.example correctly shows them as unset (empty value)
     * - SWSD_TRUST_PROXY: optional with custom transform; .env.example correctly shows it
     *   as unset rather than "false" so users see "set this if behind a proxy"
     */
    const SKIP = new Set(['SWSD_TOKEN', 'SWSD_ENABLE_EXTRAS', 'SWSD_ALLOWED_ORIGINS', 'SWSD_TRUST_PROXY']);

    for (const key of Object.keys(EnvSchema.shape)) {
      if (SKIP.has(key)) continue;
      const expected = defaults[key];
      if (expected === undefined) continue;
      it(`${key} default value matches EnvSchema (${String(expected)})`, () => {
        const documentedValue = documented.get(key) ?? '';
        expect(documentedValue).toBe(String(expected));
      });
    }
  });
});

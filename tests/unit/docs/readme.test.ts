/**
 * Documentation contract tests for README.md.
 *
 * Asserts that the human-maintained facts in the README match the
 * single source of truth in src/. These tests exist because the
 * tool-count drift bug (PR #11) showed that README claims about
 * counts/lists/defaults silently rot when the underlying code changes.
 *
 * If a test in this file fails, you have two options:
 *   1. The README is stale — update the README.
 *   2. The source genuinely changed — update the README to match.
 * In either case, never edit the test to make it pass.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROFILE_TOOLS } from '../../../src/config/profiles.js';
import { EnvSchema, KNOWN_PROFILES } from '../../../src/config/env.js';

const README = readFileSync(resolve('README.md'), 'utf-8');

describe('README documentation contract', () => {
  describe('Profiles table', () => {
    for (const profile of KNOWN_PROFILES) {
      it(`${profile} row shows the correct tool count`, () => {
        const expected = PROFILE_TOOLS[profile].length;
        // Match: | `triage` | description | 8 |
        const row = README.match(new RegExp(`\\|\\s*\`${profile}\`\\s*\\|[^|]+\\|\\s*(\\d+)\\s*\\|`));
        expect(row, `Missing or malformed Profiles-table row for "${profile}"`).not.toBeNull();
        const documented = Number(row![1]);
        expect(documented).toBe(expected);
      });
    }
  });

  describe('"Tools" header', () => {
    const headerMatch = README.match(/^## Tools \((\d+) across (\d+) categories\)/m);

    it('exists in the expected format', () => {
      expect(headerMatch, 'Could not find "## Tools (N across M categories)" header').not.toBeNull();
    });

    it('total count matches PROFILE_TOOLS.full.length', () => {
      const documented = Number(headerMatch![1]);
      expect(documented).toBe(PROFILE_TOOLS.full.length);
    });

    it('category count matches the number of category rows in the table', () => {
      const documentedCategories = Number(headerMatch![2]);
      // Extract the table that immediately follows the "## Tools" header.
      const toolsSection = README.match(/^## Tools[^]*?(?=^## )/m);
      expect(toolsSection, 'Could not extract Tools section').not.toBeNull();
      // Count rows that look like: | **Category** | tools... |
      const categoryRows = toolsSection![0].match(/^\|\s*\*\*[^*]+\*\*\s*\|/gm) ?? [];
      expect(categoryRows.length).toBe(documentedCategories);
    });
  });

  describe('Tools-by-category table', () => {
    const toolsSection = README.match(/^## Tools[^]*?(?=^## )/m)?.[0] ?? '';
    const documentedTools = new Set<string>();
    for (const m of toolsSection.matchAll(/`(swsd_[a-z_]+)`/g)) {
      documentedTools.add(m[1]!);
    }

    const fullProfileTools = new Set<string>(PROFILE_TOOLS.full);

    it('lists every tool registered in the full profile', () => {
      const missing = [...fullProfileTools].filter((t) => !documentedTools.has(t));
      expect(missing, `Tools missing from README "Tools" table: ${missing.join(', ')}`).toEqual([]);
    });

    it('does not list any tool that is not in the full profile', () => {
      const extra = [...documentedTools].filter((t) => !fullProfileTools.has(t));
      expect(extra, `README "Tools" table lists tools not registered in any profile: ${extra.join(', ')}`).toEqual([]);
    });
  });

  describe('Configuration tables', () => {
    // Parse with empty input to get all schema-level defaults.
    const defaults = EnvSchema.parse({}) as Record<string, unknown>;

    /**
     * Cases where we deliberately do NOT cross-check the README:
     * - SWSD_TOKEN: no schema default; "Required" semantic varies by transport
     * - SWSD_ENABLE_EXTRAS / SWSD_ALLOWED_ORIGINS: optional CSV transforms;
     *   schema parses to [] but README correctly shows em-dash for "unset"
     */
    const SKIP = new Set(['SWSD_TOKEN', 'SWSD_ENABLE_EXTRAS', 'SWSD_ALLOWED_ORIGINS']);

    for (const key of Object.keys(EnvSchema.shape)) {
      if (SKIP.has(key)) continue;
      const expected = defaults[key];
      if (expected === undefined) continue;
      it(`README default for ${key} matches EnvSchema default (${String(expected)})`, () => {
        // Match: | `KEY` | `default` | ... |  OR  | `KEY` | default | ... |
        // Allows backtick-wrapped or bare default token.
        const row = README.match(new RegExp(`\\|\\s*\`${key}\`\\s*\\|\\s*\`?([^|\`]+?)\`?\\s*\\|`));
        expect(row, `Missing Configuration-table row for "${key}"`).not.toBeNull();
        const documented = row![1]!.trim();
        expect(documented).toBe(String(expected));
      });
    }
  });
});

import { describe, it, expect } from 'vitest';
import { PROFILE_TOOLS } from '../../src/config/profiles.js';

const SEP_986_TOOL_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/;

describe('tool names (SEP-986 spec 2025-11-25 compliance)', () => {
  const allNames = new Set<string>();
  for (const tools of Object.values(PROFILE_TOOLS)) {
    for (const t of tools) allNames.add(t);
  }

  for (const name of [...allNames].sort()) {
    it(`"${name}" matches SEP-986 format`, () => {
      expect(name).toMatch(SEP_986_TOOL_NAME_RE);
    });
  }

  it('has at least one tool registered (sanity check)', () => {
    expect(allNames.size).toBeGreaterThan(0);
  });
});

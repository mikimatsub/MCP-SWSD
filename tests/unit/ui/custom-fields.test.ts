import { describe, it, expect } from 'vitest';
import {
  matchesQuery,
  matchesFilters,
  extractFilterOptions,
  filterFields,
  sortFieldsByName,
  type CustomField,
  type Filters,
} from '../../../src/ui/custom-fields/logic.js';

/**
 * The custom-fields filter logic is pure (no DOM, no globals) so it runs
 * unmodified in the default node vitest env. The DOM wiring (search input
 * listener, dropdown change handlers, render) lives in
 * `src/ui/custom-fields/index.ts` and is excluded from these tests by design
 * — `logic.ts` is the canonical entry point for testable behavior.
 */

const field = (extra: Partial<CustomField>): CustomField => ({
  id: 1,
  name: 'Field',
  type: 'Text',
  required: false,
  active: true,
  searchable: false,
  ...extra,
});

describe('matchesQuery', () => {
  it('matches name as a case-insensitive substring', () => {
    expect(matchesQuery(field({ name: 'Severity' }), 'sev')).toBe(true);
  });

  it('matches name regardless of haystack/needle case', () => {
    expect(matchesQuery(field({ name: 'Severity' }), 'SEV')).toBe(true);
    expect(matchesQuery(field({ name: 'SEVERITY' }), 'sev')).toBe(true);
  });

  it('returns false when the substring is not present', () => {
    expect(matchesQuery(field({ name: 'Severity' }), 'foo')).toBe(false);
  });

  it('matches help_text', () => {
    expect(
      matchesQuery(field({ name: 'X', help_text: 'Used for triage' }), 'triage'),
    ).toBe(true);
  });

  it('matches help_text case-insensitively', () => {
    expect(
      matchesQuery(field({ name: 'X', help_text: 'Used for TRIAGE' }), 'triage'),
    ).toBe(true);
  });

  it('returns true for an empty query (matches all)', () => {
    expect(matchesQuery(field({ name: 'X' }), '')).toBe(true);
  });

  it('returns true for a whitespace-only query', () => {
    expect(matchesQuery(field({ name: 'X' }), '   ')).toBe(true);
  });

  it('returns false when neither name nor help_text contain the query', () => {
    expect(
      matchesQuery(field({ name: 'A', help_text: 'B' }), 'unrelated'),
    ).toBe(false);
  });

  it('does not throw when help_text is missing', () => {
    expect(matchesQuery(field({ name: 'A' }), 'a')).toBe(true);
  });
});

describe('matchesFilters', () => {
  it('returns true when no filter is set (active_only=false)', () => {
    const filters: Filters = { q: '', scope: '', module: '', activeOnly: false };
    expect(matchesFilters(field({ name: 'X' }), filters)).toBe(true);
  });

  it('respects activeOnly — drops inactive fields when checked', () => {
    const filters: Filters = { q: '', scope: '', module: '', activeOnly: true };
    expect(matchesFilters(field({ active: false }), filters)).toBe(false);
    expect(matchesFilters(field({ active: true }), filters)).toBe(true);
  });

  it('respects activeOnly=false — keeps inactive fields', () => {
    const filters: Filters = { q: '', scope: '', module: '', activeOnly: false };
    expect(matchesFilters(field({ active: false }), filters)).toBe(true);
    expect(matchesFilters(field({ active: true }), filters)).toBe(true);
  });

  it('filters by scope when scope is set', () => {
    const filters: Filters = { q: '', scope: 'Incident', module: '', activeOnly: false };
    expect(matchesFilters(field({ scope: 'Incident' }), filters)).toBe(true);
    expect(matchesFilters(field({ scope: 'Global' }), filters)).toBe(false);
    expect(matchesFilters(field({}), filters)).toBe(false);
  });

  it('filters by module when module is set', () => {
    const filters: Filters = { q: '', scope: '', module: 'Catalog', activeOnly: false };
    expect(matchesFilters(field({ module: 'Catalog' }), filters)).toBe(true);
    expect(matchesFilters(field({ module: 'Other' }), filters)).toBe(false);
    expect(matchesFilters(field({}), filters)).toBe(false);
  });

  it('filters by query when q is set', () => {
    const filters: Filters = { q: 'sev', scope: '', module: '', activeOnly: false };
    expect(matchesFilters(field({ name: 'Severity' }), filters)).toBe(true);
    expect(matchesFilters(field({ name: 'Other' }), filters)).toBe(false);
  });

  it('combines all filters with AND semantics', () => {
    const filters: Filters = {
      q: 'sev',
      scope: 'Incident',
      module: 'Triage',
      activeOnly: true,
    };
    expect(
      matchesFilters(
        field({
          name: 'Severity',
          scope: 'Incident',
          module: 'Triage',
          active: true,
        }),
        filters,
      ),
    ).toBe(true);
    // failing on activeOnly
    expect(
      matchesFilters(
        field({
          name: 'Severity',
          scope: 'Incident',
          module: 'Triage',
          active: false,
        }),
        filters,
      ),
    ).toBe(false);
    // failing on scope
    expect(
      matchesFilters(
        field({
          name: 'Severity',
          scope: 'Global',
          module: 'Triage',
          active: true,
        }),
        filters,
      ),
    ).toBe(false);
    // failing on module
    expect(
      matchesFilters(
        field({
          name: 'Severity',
          scope: 'Incident',
          module: 'Other',
          active: true,
        }),
        filters,
      ),
    ).toBe(false);
    // failing on q
    expect(
      matchesFilters(
        field({
          name: 'Other',
          scope: 'Incident',
          module: 'Triage',
          active: true,
        }),
        filters,
      ),
    ).toBe(false);
  });
});

describe('extractFilterOptions', () => {
  it('returns unique values sorted alphabetically', () => {
    const fields: CustomField[] = [
      field({ scope: 'Incident' }),
      field({ scope: 'Global' }),
      field({ scope: 'Incident' }),
      field({ scope: 'Asset' }),
    ];
    expect(extractFilterOptions(fields, 'scope')).toEqual([
      'Asset',
      'Global',
      'Incident',
    ]);
  });

  it('skips entries missing the key', () => {
    const fields: CustomField[] = [
      field({ scope: 'Incident' }),
      field({}), // no scope
      field({ scope: 'Global' }),
    ];
    expect(extractFilterOptions(fields, 'scope')).toEqual(['Global', 'Incident']);
  });

  it('returns empty array when no entries have the key', () => {
    const fields: CustomField[] = [field({}), field({})];
    expect(extractFilterOptions(fields, 'scope')).toEqual([]);
  });

  it('extracts module values', () => {
    const fields: CustomField[] = [
      field({ module: 'Triage' }),
      field({ module: 'Catalog' }),
      field({ module: 'Triage' }),
    ];
    expect(extractFilterOptions(fields, 'module')).toEqual(['Catalog', 'Triage']);
  });

  it('skips empty-string values defensively', () => {
    const fields: CustomField[] = [
      field({ scope: 'Incident' }),
      field({ scope: '' as unknown as string }),
    ];
    expect(extractFilterOptions(fields, 'scope')).toEqual(['Incident']);
  });
});

describe('filterFields', () => {
  it('combines query, scope, module, and activeOnly filters', () => {
    const fields: CustomField[] = [
      field({ name: 'Severity', scope: 'Incident', module: 'Triage', active: true }),
      field({ name: 'Priority', scope: 'Incident', module: 'Triage', active: true }),
      field({ name: 'Severity', scope: 'Global', module: 'Triage', active: true }),
      field({ name: 'Severity', scope: 'Incident', module: 'Catalog', active: true }),
      field({ name: 'Severity', scope: 'Incident', module: 'Triage', active: false }),
    ];
    const filters: Filters = {
      q: 'sev',
      scope: 'Incident',
      module: 'Triage',
      activeOnly: true,
    };
    const out = filterFields(fields, filters);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('Severity');
  });

  it('returns the full set when no filters apply (activeOnly=false)', () => {
    const fields: CustomField[] = [
      field({ name: 'A' }),
      field({ name: 'B' }),
    ];
    const filters: Filters = { q: '', scope: '', module: '', activeOnly: false };
    const out = filterFields(fields, filters);
    expect(out).toHaveLength(2);
  });

  it('does not mutate the input array', () => {
    const input: CustomField[] = [field({ name: 'B' }), field({ name: 'A' })];
    const before = [...input];
    filterFields(input, { q: '', scope: '', module: '', activeOnly: false });
    expect(input).toEqual(before);
  });
});

describe('sortFieldsByName', () => {
  it('sorts fields alphabetically by name', () => {
    const fields: CustomField[] = [
      field({ name: 'Banana' }),
      field({ name: 'Apple' }),
      field({ name: 'Cherry' }),
    ];
    const out = sortFieldsByName(fields);
    expect(out.map((f) => f.name)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('returns a new array (does not mutate input)', () => {
    const input: CustomField[] = [field({ name: 'B' }), field({ name: 'A' })];
    const before = [...input];
    sortFieldsByName(input);
    expect(input).toEqual(before);
  });

  it('puts entries with empty names at the end', () => {
    const fields: CustomField[] = [
      field({ name: '' as unknown as string }),
      field({ name: 'A' }),
      field({ name: 'B' }),
    ];
    const out = sortFieldsByName(fields);
    // empty-string names sort to the END regardless of alphabetic position
    // — see comment in logic.ts about the parallel cmp helper.
    expect(out.map((f) => f.name)).toEqual(['A', 'B', '']);
  });

  it('is case-insensitive (a before B before c)', () => {
    const fields: CustomField[] = [
      field({ name: 'c' }),
      field({ name: 'B' }),
      field({ name: 'a' }),
    ];
    const out = sortFieldsByName(fields);
    expect(out.map((f) => f.name.toLowerCase())).toEqual(['a', 'b', 'c']);
  });
});

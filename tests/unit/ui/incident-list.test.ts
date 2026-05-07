import { describe, it, expect } from 'vitest';
import {
  matchesQuery,
  cmp,
  pickSortValue,
  filterAndSort,
  SORT_KEYS,
  type Incident,
  type SortKey,
} from '../../../src/ui/incident-list/logic.js';

/**
 * The incident-list filter/sort logic is pure (no DOM, no globals) so it runs
 * unmodified in the default node vitest env. The DOM wiring (search input
 * listener, header click handlers, render) lives in `src/ui/incident-list/
 * index.ts` and is excluded from these tests by design — `logic.ts` is the
 * canonical entry point for testable behavior.
 */

describe('SORT_KEYS', () => {
  it('contains exactly the six column keys', () => {
    expect([...SORT_KEYS].sort()).toEqual(
      ['number', 'name', 'state', 'priority', 'assignee_email', 'updated_at'].sort(),
    );
  });
});

describe('matchesQuery', () => {
  it('matches name as a case-insensitive substring', () => {
    expect(matchesQuery({ name: 'Server down' }, 'down')).toBe(true);
  });

  it('matches name regardless of haystack/needle case', () => {
    expect(matchesQuery({ name: 'Server down' }, 'DOWN')).toBe(true);
    expect(matchesQuery({ name: 'SERVER DOWN' }, 'down')).toBe(true);
  });

  it('returns false when the substring is not present', () => {
    expect(matchesQuery({ name: 'Server down' }, 'router')).toBe(false);
  });

  it('matches assignee_email', () => {
    expect(matchesQuery({ assignee_email: 'a@b.com' }, 'a@b')).toBe(true);
  });

  it('matches requester_email', () => {
    expect(matchesQuery({ requester_email: 'rq@x.com' }, 'rq')).toBe(true);
  });

  it('matches a flat category string', () => {
    expect(matchesQuery({ category: 'Network' }, 'net')).toBe(true);
  });

  it('matches a nested category.name', () => {
    expect(matchesQuery({ category: { name: 'Network' } }, 'net')).toBe(true);
  });

  it('returns false when no searchable field is present', () => {
    expect(matchesQuery({}, 'foo')).toBe(false);
  });

  it('returns true for an empty query (matches all)', () => {
    expect(matchesQuery({ name: 'X' }, '')).toBe(true);
  });

  it('returns true for a whitespace-only query', () => {
    expect(matchesQuery({ name: 'X' }, '   ')).toBe(true);
  });
});

describe('cmp', () => {
  it('orders numbers ascending when desc=false', () => {
    expect(cmp(1, 2, false)).toBeLessThan(0);
  });

  it('orders numbers descending when desc=true', () => {
    expect(cmp(1, 2, true)).toBeGreaterThan(0);
  });

  it('orders strings ascending when desc=false', () => {
    expect(cmp('a', 'b', false)).toBeLessThan(0);
  });

  it('orders strings descending when desc=true', () => {
    expect(cmp('a', 'b', true)).toBeGreaterThan(0);
  });

  it('puts undefined at the end on asc', () => {
    expect(cmp(undefined, 'a', false)).toBe(1);
  });

  it('puts undefined at the end on desc (regression for direction-flip bug)', () => {
    // Before the fix: cmp returned 1, then index.ts multiplied by -1 because
    // sortDesc, putting empties at the TOP of the descending view. After:
    // direction is applied only to present-vs-present, so empty stays last.
    expect(cmp(undefined, 'a', true)).toBe(1);
  });

  it('keeps a present value before a missing value on asc', () => {
    expect(cmp('a', undefined, false)).toBe(-1);
  });

  it('keeps a present value before a missing value on desc (regression)', () => {
    expect(cmp('a', undefined, true)).toBe(-1);
  });

  it('treats null the same as undefined', () => {
    expect(cmp(null, 'a', false)).toBe(1);
    expect(cmp(null, 'a', true)).toBe(1);
    expect(cmp('a', null, false)).toBe(-1);
    expect(cmp('a', null, true)).toBe(-1);
  });

  it('returns 0 when both values are missing', () => {
    expect(cmp(undefined, undefined, false)).toBe(0);
    expect(cmp(null, null, false)).toBe(0);
    expect(cmp(undefined, null, false)).toBe(0);
  });
});

describe('pickSortValue', () => {
  it('returns numeric value for the number column', () => {
    expect(pickSortValue({ number: 42 }, 'number')).toBe(42);
  });

  it('returns string value for non-number columns', () => {
    expect(pickSortValue({ name: 'X' }, 'name')).toBe('X');
    expect(pickSortValue({ state: 'New' }, 'state')).toBe('New');
  });

  it('returns undefined when the field is missing', () => {
    expect(pickSortValue({}, 'name')).toBeUndefined();
  });
});

describe('filterAndSort', () => {
  const inc = (extra: Record<string, unknown>): Incident => extra;

  it('sorts by name ascending', () => {
    const out = filterAndSort(
      [inc({ name: 'B', updated_at: '2026-01-02' }), inc({ name: 'A', updated_at: '2026-01-01' })],
      '',
      'name',
      false,
    );
    expect(out.map((i) => i['name'])).toEqual(['A', 'B']);
  });

  it('sorts by name descending', () => {
    const out = filterAndSort(
      [inc({ name: 'A' }), inc({ name: 'B' })],
      '',
      'name',
      true,
    );
    expect(out.map((i) => i['name'])).toEqual(['B', 'A']);
  });

  it('filters then sorts — query narrows the set before ordering', () => {
    const out = filterAndSort(
      [inc({ name: 'B' }), inc({ name: 'A' }), inc({ name: 'B' })],
      'A',
      'name',
      false,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.['name']).toBe('A');
  });

  it('puts an entry missing the sort field AT THE END on asc', () => {
    const out = filterAndSort(
      [
        inc({ name: 'A', updated_at: '2026-01-02' }),
        inc({ name: 'B' }), // no updated_at
        inc({ name: 'C', updated_at: '2026-01-01' }),
      ],
      '',
      'updated_at',
      false,
    );
    expect(out.map((i) => i['name'])).toEqual(['C', 'A', 'B']);
  });

  it('puts an entry missing the sort field AT THE END on desc (regression for Critical 1)', () => {
    // The direction-flip bug used to surface here: the missing-updated_at
    // row ended up at the TOP of the table (index 0) on the default
    // `updated_at desc` view. Asserting that it stays at the END on desc
    // pins the fix.
    const out = filterAndSort(
      [
        inc({ name: 'A', updated_at: '2026-01-01' }),
        inc({ name: 'B' }), // no updated_at
        inc({ name: 'C', updated_at: '2026-01-02' }),
      ],
      '',
      'updated_at',
      true,
    );
    expect(out.map((i) => i['name'])).toEqual(['C', 'A', 'B']);
  });

  it('does not mutate the input array', () => {
    const input = [inc({ name: 'B' }), inc({ name: 'A' })];
    const before = [...input];
    filterAndSort(input, '', 'name', false);
    expect(input).toEqual(before);
  });

  it('sorts numbers numerically (9 before 10, not lexicographic)', () => {
    const out = filterAndSort(
      [inc({ number: 10 }), inc({ number: 9 })],
      '',
      'number',
      false,
    );
    expect(out.map((i) => i['number'])).toEqual([9, 10]);
  });

  it('handles all SortKey values without throwing', () => {
    const keys: SortKey[] = ['number', 'name', 'state', 'priority', 'assignee_email', 'updated_at'];
    for (const k of keys) {
      expect(() => filterAndSort([inc({ name: 'X' })], '', k, false)).not.toThrow();
    }
  });
});

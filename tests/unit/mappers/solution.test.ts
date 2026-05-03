import { describe, it, expect } from 'vitest';
import {
  toSolutionSummary,
  toSolutionDetail,
  buildSolutionWritePayload,
} from '../../../src/swsd/mappers/solution.js';

describe('toSolutionSummary', () => {
  it('projects compact summary from a full SWSD solution response', () => {
    const raw = {
      id: 999,
      number: 999,
      name: 'How to reset a password',
      state: 'Internal',
      description: '<p>Long HTML body...</p>',
      description_no_html: 'Long plain text body that explains the procedure step by step.',
      category: { name: 'Software', id: 1, href: '/incident_types/1' },
      requester: { email: 'author@example.com', name: 'Carol' },
      updated_at: '2026-05-01T16:55:41.000-04:00',
      href: '/solutions/999.json',
      custom_fields_values: [],
      tags: ['password', 'reset'],
    };
    const s = toSolutionSummary(raw);
    expect(s).toEqual({
      id: 999,
      number: 999,
      name: 'How to reset a password',
      state: 'Internal',
      category: 'Software',
      excerpt: 'Long plain text body that explains the procedure step by step.',
      requester_email: 'author@example.com',
      updated_at: '2026-05-01T16:55:41.000-04:00',
      href: '/solutions/999.json',
    });
  });

  it('truncates long excerpts to 240 chars + ellipsis', () => {
    const long = 'word '.repeat(100); // 500 chars
    const s = toSolutionSummary({ id: 1, name: 'x', description_no_html: long });
    expect(s?.excerpt?.length).toBeLessThanOrEqual(243); // 240 + "..."
    expect(s?.excerpt?.endsWith('...')).toBe(true);
  });

  it('collapses excessive whitespace in excerpt', () => {
    const s = toSolutionSummary({
      id: 1,
      name: 'x',
      description_no_html: '  multiple   spaces\n\nand\tlinebreaks  ',
    });
    expect(s?.excerpt).toBe('multiple spaces and linebreaks');
  });

  it('does not include excerpt when description_no_html is missing', () => {
    const s = toSolutionSummary({ id: 1, name: 'x' });
    expect(s?.excerpt).toBeUndefined();
  });

  it('does not leak the HTML description field', () => {
    const s = toSolutionSummary({ id: 1, name: 'x', description: '<p>HTML</p>' });
    expect(s).not.toHaveProperty('description');
  });

  it('returns null for non-objects and missing id', () => {
    expect(toSolutionSummary(null)).toBeNull();
    expect(toSolutionSummary([])).toBeNull();
    expect(toSolutionSummary({ name: 'no id' })).toBeNull();
  });

  it('coerces stringified id', () => {
    const s = toSolutionSummary({ id: '42', name: 'x' });
    expect(s?.id).toBe(42);
  });
});

describe('toSolutionDetail', () => {
  it('passes through every field keyed by id', () => {
    const raw = { id: 1, name: 'x', description: '<p>html</p>', custom_fields_values: [], tags: ['a'] };
    expect(toSolutionDetail(raw)).toEqual(raw);
  });

  it('returns null for arrays and non-objects', () => {
    expect(toSolutionDetail(null)).toBeNull();
    expect(toSolutionDetail([1, 2])).toBeNull();
    expect(toSolutionDetail('string')).toBeNull();
  });
});

describe('buildSolutionWritePayload', () => {
  it('wraps fields under {solution: ...}', () => {
    expect(buildSolutionWritePayload({ name: 'Test' })).toEqual({
      solution: { name: 'Test' },
    });
  });

  it('nests category as { name }', () => {
    expect(buildSolutionWritePayload({ category_name: 'Hardware' })).toEqual({
      solution: { category: { name: 'Hardware' } },
    });
  });

  it('omits unset fields', () => {
    const p = buildSolutionWritePayload({ name: 'x' });
    expect(p.solution).not.toHaveProperty('description');
    expect(p.solution).not.toHaveProperty('state');
  });

  it('preserves explicit empty description (clearing the body)', () => {
    expect(buildSolutionWritePayload({ description: '' })).toEqual({
      solution: { description: '' },
    });
  });

  it('returns empty solution object when no fields provided', () => {
    expect(buildSolutionWritePayload({})).toEqual({ solution: {} });
  });

  it('handles full create payload', () => {
    expect(
      buildSolutionWritePayload({
        name: 'Article',
        description: '<p>body</p>',
        state: 'Internal',
        category_name: 'Software',
      }),
    ).toEqual({
      solution: {
        name: 'Article',
        description: '<p>body</p>',
        state: 'Internal',
        category: { name: 'Software' },
      },
    });
  });
});

import { describe, it, expect } from 'vitest';
import { serializeQuery } from '../../src/swsd/query.js';

describe('serializeQuery', () => {
  it('serializes scalar params', () => {
    expect(serializeQuery({ page: 1, per_page: 25 })).toBe('page=1&per_page=25');
  });

  it('uses repeated-key array convention for arrays', () => {
    expect(serializeQuery({ state: ['New', 'Assigned'] })).toBe(
      'state%5B%5D=New&state%5B%5D=Assigned',
    );
  });

  it('skips null and undefined values', () => {
    expect(serializeQuery({ a: 1, b: null, c: undefined, d: 2 })).toBe('a=1&d=2');
  });

  it('skips null and undefined inside arrays', () => {
    expect(serializeQuery({ x: [1, null, 2, undefined, 3] })).toBe(
      'x%5B%5D=1&x%5B%5D=2&x%5B%5D=3',
    );
  });

  it('serializes Date as ISO string', () => {
    const d = new Date('2026-04-01T00:00:00.000Z');
    expect(serializeQuery({ ts: d })).toBe('ts=2026-04-01T00%3A00%3A00.000Z');
  });

  it('encodes special characters in keys and values', () => {
    expect(serializeQuery({ 'q&p': 'a b' })).toBe('q%26p=a%20b');
  });

  it('returns empty string for empty params', () => {
    expect(serializeQuery({})).toBe('');
  });

  it('handles boolean and zero correctly', () => {
    expect(serializeQuery({ a: false, b: 0, c: true })).toBe('a=false&b=0&c=true');
  });

  it('serializes the SWSD updated_at filter pattern', () => {
    expect(serializeQuery({ updated_at: ['greater_than', '2026-04-01'] })).toBe(
      'updated_at%5B%5D=greater_than&updated_at%5B%5D=2026-04-01',
    );
  });
});

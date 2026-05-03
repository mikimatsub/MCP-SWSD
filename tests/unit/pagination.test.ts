import { describe, it, expect } from 'vitest';
import { parseLinkHeader, extractPagination } from '../../src/swsd/pagination.js';

function makeHeaders(init: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(init)) h.set(k, v);
  return h;
}

describe('parseLinkHeader', () => {
  it('parses single rel=next', () => {
    const m = parseLinkHeader('<https://api.example.com/incidents?page=2>; rel="next"');
    expect(m.get('next')).toBe('https://api.example.com/incidents?page=2');
  });

  it('parses multiple links', () => {
    const m = parseLinkHeader(
      '<https://api.example.com/incidents?page=2>; rel="next", <https://api.example.com/incidents?page=10>; rel="last"',
    );
    expect(m.get('next')).toBe('https://api.example.com/incidents?page=2');
    expect(m.get('last')).toBe('https://api.example.com/incidents?page=10');
  });

  it('handles missing or empty header', () => {
    expect(parseLinkHeader(null).size).toBe(0);
    expect(parseLinkHeader(undefined).size).toBe(0);
    expect(parseLinkHeader('').size).toBe(0);
  });

  it('parses unquoted rel values', () => {
    const m = parseLinkHeader('<https://example.com/?page=2>; rel=next');
    expect(m.get('next')).toBe('https://example.com/?page=2');
  });
});

describe('extractPagination', () => {
  it('uses X-Total-Count when present', () => {
    const h = makeHeaders({ 'X-Total-Count': '120' });
    const p = extractPagination(h, 1, 25, 25);
    expect(p.total).toBe(120);
    expect(p.has_more).toBe(true);
    expect(p.next_page).toBe(2);
  });

  it('uses Link header next when present (extracts page from URL)', () => {
    const h = makeHeaders({
      Link: '<https://api.example.com/incidents?page=3&per_page=25>; rel="next"',
    });
    const p = extractPagination(h, 2, 25, 25);
    expect(p.has_more).toBe(true);
    expect(p.next_page).toBe(3);
  });

  it('returns has_more=false when bodyLength < per_page and no headers', () => {
    const h = makeHeaders({});
    const p = extractPagination(h, 1, 25, 10);
    expect(p.has_more).toBe(false);
    expect(p.next_page).toBeUndefined();
  });

  it('returns has_more=true when full page returned without total', () => {
    const h = makeHeaders({});
    const p = extractPagination(h, 1, 25, 25);
    expect(p.has_more).toBe(true);
    expect(p.next_page).toBe(2);
  });

  it('returns has_more=false when total reached exactly', () => {
    const h = makeHeaders({ 'X-Total-Count': '50' });
    const p = extractPagination(h, 2, 25, 25);
    expect(p.has_more).toBe(false);
  });

  it('falls back to x-total when x-total-count is missing', () => {
    const h = makeHeaders({ 'X-Total': '7' });
    const p = extractPagination(h, 1, 25, 7);
    expect(p.total).toBe(7);
    expect(p.has_more).toBe(false);
  });
});

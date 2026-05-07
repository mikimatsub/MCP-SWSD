import { describe, it, expect } from 'vitest';
import {
  pickString,
  pickNumber,
  pickNestedString,
  formatDate,
  isSafeHttpUrl,
} from '../../../src/ui/shared/format.js';

/**
 * The five helpers in `src/ui/shared/format.ts` are pure (no DOM, no I/O,
 * no globals) so they run unmodified in the default node vitest env. Tests
 * exercise the boundary conditions and the protocol-relative URL bypass
 * regression for `isSafeHttpUrl`.
 */

describe('pickString', () => {
  it('returns the value when it is a non-empty string', () => {
    expect(pickString({ k: 'hello' }, 'k')).toBe('hello');
  });

  it('returns undefined for an empty string', () => {
    expect(pickString({ k: '' }, 'k')).toBeUndefined();
  });

  it('returns undefined when the key is missing', () => {
    expect(pickString({}, 'k')).toBeUndefined();
  });

  it('returns undefined when the value is not a string', () => {
    expect(pickString({ k: 42 }, 'k')).toBeUndefined();
    expect(pickString({ k: null }, 'k')).toBeUndefined();
    expect(pickString({ k: { nested: 'x' } }, 'k')).toBeUndefined();
  });
});

describe('pickNumber', () => {
  it('returns finite numbers', () => {
    expect(pickNumber({ k: 42 }, 'k')).toBe(42);
    expect(pickNumber({ k: 0 }, 'k')).toBe(0);
    expect(pickNumber({ k: -7.5 }, 'k')).toBe(-7.5);
  });

  it('returns undefined for NaN and Infinity', () => {
    expect(pickNumber({ k: NaN }, 'k')).toBeUndefined();
    expect(pickNumber({ k: Infinity }, 'k')).toBeUndefined();
    expect(pickNumber({ k: -Infinity }, 'k')).toBeUndefined();
  });

  it('returns undefined for non-numeric values', () => {
    expect(pickNumber({ k: '42' }, 'k')).toBeUndefined();
    expect(pickNumber({ k: null }, 'k')).toBeUndefined();
    expect(pickNumber({}, 'k')).toBeUndefined();
  });
});

describe('pickNestedString', () => {
  it('returns the nested string when both parent and child are present', () => {
    expect(pickNestedString({ category: { name: 'Network' } }, 'category', 'name')).toBe('Network');
  });

  it('returns undefined when the parent is missing', () => {
    expect(pickNestedString({}, 'category', 'name')).toBeUndefined();
  });

  it('returns undefined when the parent is not a plain object', () => {
    expect(pickNestedString({ category: 'flat' }, 'category', 'name')).toBeUndefined();
    expect(pickNestedString({ category: null }, 'category', 'name')).toBeUndefined();
  });

  it('returns undefined when the parent is an array', () => {
    expect(pickNestedString({ category: ['Network'] }, 'category', 'name')).toBeUndefined();
  });

  it('returns undefined when the child string is empty', () => {
    expect(pickNestedString({ category: { name: '' } }, 'category', 'name')).toBeUndefined();
  });

  it('returns undefined when the child key is missing', () => {
    expect(pickNestedString({ category: { other: 'X' } }, 'category', 'name')).toBeUndefined();
  });
});

describe('formatDate', () => {
  it('formats a valid ISO timestamp via toLocaleString()', () => {
    // Don't pin the exact locale-formatted output (host-dependent); just assert
    // it changed away from the raw ISO and looks like a localized date.
    const out = formatDate('2026-01-15T12:34:56Z');
    expect(out).not.toBe('2026-01-15T12:34:56Z');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('returns the raw input when the date is unparseable', () => {
    expect(formatDate('not a date')).toBe('not a date');
  });
});

describe('isSafeHttpUrl', () => {
  it('accepts http: absolute URLs', () => {
    expect(isSafeHttpUrl('http://example.com')).toBe(true);
  });

  it('accepts https: absolute URLs', () => {
    expect(isSafeHttpUrl('https://example.com')).toBe(true);
  });

  it('accepts same-origin paths', () => {
    expect(isSafeHttpUrl('/incidents/42')).toBe(true);
  });

  it('rejects javascript: scheme', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects mailto: scheme (not http/s, not same-origin)', () => {
    expect(isSafeHttpUrl('mailto:foo@bar.com')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isSafeHttpUrl(undefined)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSafeHttpUrl('')).toBe(false);
  });

  it('rejects protocol-relative URLs (//evil.com bypass regression)', () => {
    // The single-slash same-origin rule used to fire before the double-slash
    // check, letting "//evil.com/foo" through. Order of checks now rejects
    // protocol-relative URLs first.
    expect(isSafeHttpUrl('//evil.com/foo')).toBe(false);
  });

  it('rejects whitespace-padded protocol-relative URLs', () => {
    // The trim() inside isSafeHttpUrl normalizes leading whitespace before
    // the prefix checks — without it, "   //evil.com" could slip past both
    // the // check and the / shortcut.
    expect(isSafeHttpUrl('   //evil.com/foo')).toBe(false);
  });
});

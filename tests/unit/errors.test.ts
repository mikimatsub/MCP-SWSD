import { describe, it, expect } from 'vitest';
import { SwsdHttpError, SwsdNetworkError, mapSwsdError } from '../../src/swsd/errors.js';

function getText(result: ReturnType<typeof mapSwsdError>): string {
  const first = result.content[0];
  if (first && 'text' in first && typeof first.text === 'string') return first.text;
  throw new Error('expected text content');
}

describe('mapSwsdError', () => {
  it('maps 401 to clear unauthorized message with hint', () => {
    const r = mapSwsdError(new SwsdHttpError(401, { error: 'Bad token' }));
    expect(r.isError).toBe(true);
    const text = getText(r);
    expect(text).toMatch(/Unauthorized/);
    expect(text).toMatch(/Hint:/);
  });

  it('maps 403 with permission hint', () => {
    const r = mapSwsdError(new SwsdHttpError(403, {}));
    expect(r.isError).toBe(true);
    expect(getText(r)).toMatch(/Forbidden/);
    expect(getText(r)).toMatch(/permission/);
  });

  it('maps 404 with body content', () => {
    const r = mapSwsdError(new SwsdHttpError(404, { error: 'No incident with id=42' }));
    const text = getText(r);
    expect(text).toMatch(/Not found/);
    expect(text).toMatch(/42/);
  });

  it('does not duplicate "Not found" when body is just the literal string', () => {
    const r = mapSwsdError(new SwsdHttpError(404, 'Not Found'));
    const text = getText(r);
    expect(text).not.toMatch(/Not found: Not Found/i);
    expect(text).toMatch(/Not found\./);
    expect(text).toMatch(/Hint:/);
  });

  it('also dedupes when body is empty', () => {
    const r = mapSwsdError(new SwsdHttpError(404, ''));
    const text = getText(r);
    expect(text).toMatch(/Not found\./);
    expect(text).toMatch(/Hint:/);
  });

  it('flattens 422 field-keyed errors into one line per field', () => {
    const r = mapSwsdError(
      new SwsdHttpError(422, {
        name: ["can't be blank"],
        priority: ['is not included in the list'],
      }),
    );
    const text = getText(r);
    expect(text).toMatch(/Validation failed/);
    expect(text).toMatch(/name: can't be blank/);
    expect(text).toMatch(/priority: is not included/);
  });

  it('flattens 422 nested under errors key', () => {
    const r = mapSwsdError(
      new SwsdHttpError(422, {
        errors: { state: ['transition not allowed'] },
      }),
    );
    expect(getText(r)).toMatch(/state: transition not allowed/);
  });

  it('handles 422 string-valued field', () => {
    const r = mapSwsdError(new SwsdHttpError(422, { name: 'is required' }));
    expect(getText(r)).toMatch(/name: is required/);
  });

  it('maps 429 with Retry-After', () => {
    const r = mapSwsdError(new SwsdHttpError(429, {}, '60'));
    const text = getText(r);
    expect(text).toMatch(/Rate limited/);
    expect(text).toMatch(/60/);
  });

  it('maps 5xx as transient with retry hint', () => {
    const r = mapSwsdError(new SwsdHttpError(503, 'Service unavailable'));
    const text = getText(r);
    expect(text).toMatch(/server error/i);
    expect(text).toMatch(/retry/i);
  });

  it('maps 400 with body included', () => {
    const r = mapSwsdError(new SwsdHttpError(400, { message: 'bad query' }));
    expect(getText(r)).toMatch(/Bad request/);
    expect(getText(r)).toMatch(/bad query/);
  });

  it('maps SwsdNetworkError', () => {
    const r = mapSwsdError(new SwsdNetworkError(new Error('ECONNREFUSED')));
    const text = getText(r);
    expect(text).toMatch(/Network error/);
    expect(text).toMatch(/ECONNREFUSED/);
  });

  it('maps unexpected Error gracefully', () => {
    const r = mapSwsdError(new Error('something weird'));
    expect(getText(r)).toMatch(/Unexpected error/);
    expect(getText(r)).toMatch(/something weird/);
  });

  it('maps non-Error exceptions', () => {
    const r = mapSwsdError('string thrown');
    expect(getText(r)).toMatch(/Unexpected error/);
  });
});

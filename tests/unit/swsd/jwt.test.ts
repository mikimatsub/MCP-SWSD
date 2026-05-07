import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, getUserIdFromJwtClaims } from '../../../src/swsd/jwt.js';

describe('decodeJwtPayload', () => {
  // Sample SWSD JWT from the official API docs (header.payload.signature).
  // Header `{"alg":"HS512"}` payload `{"user_ic":1256943,"generated_at":"2017-06-07 09:17:29"}`
  // Signature is opaque — we never verify it (we just trust the issuer).
  const SAMPLE_JWT =
    'eyJhbGciOiJIUzUxMiJ9.' +
    'eyJ1c2VyX2ljIjoxMjU2OTQzLCJnZW5lcmF0ZWRfYXQiOiIyMDE3LTA2LTA3IDA5OjE3OjI5In0.' +
    'j_H15qzJJr_signature_placeholder_';

  it('extracts user_ic and generated_at from a valid JWT', () => {
    const payload = decodeJwtPayload(SAMPLE_JWT);
    expect(payload).not.toBeNull();
    expect(payload?.user_ic).toBe(1256943);
    expect(payload?.generated_at).toBe('2017-06-07 09:17:29');
  });

  it('returns the full claims object so unknown claims (e.g. ESM service_provider_id) survive', () => {
    // Synthetic ESM-style payload with an extra claim
    const esmHeader = Buffer.from(JSON.stringify({ alg: 'HS512' })).toString('base64url');
    const esmPayload = Buffer.from(
      JSON.stringify({ user_ic: 42, generated_at: '2026-05-07 00:00:00', service_provider_id: 99 }),
    ).toString('base64url');
    const esmJwt = `${esmHeader}.${esmPayload}.signature`;

    const payload = decodeJwtPayload(esmJwt);
    expect(payload).not.toBeNull();
    expect(payload).toEqual({
      user_ic: 42,
      generated_at: '2026-05-07 00:00:00',
      service_provider_id: 99,
    });
  });

  it('returns null for a non-JWT string (no dots)', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('returns null for a string with wrong number of segments', () => {
    expect(decodeJwtPayload('only.two')).toBeNull();
    expect(decodeJwtPayload('a.b.c.d')).toBeNull();
  });

  it('returns null when the payload segment is invalid base64', () => {
    expect(decodeJwtPayload('header.!!!not-base64!!!.sig')).toBeNull();
  });

  it('returns null when the payload decodes to non-JSON', () => {
    const badPayload = Buffer.from('not json').toString('base64url');
    expect(decodeJwtPayload(`header.${badPayload}.sig`)).toBeNull();
  });

  it('returns null when the payload is JSON but not an object', () => {
    const arrayPayload = Buffer.from(JSON.stringify([1, 2, 3])).toString('base64url');
    expect(decodeJwtPayload(`header.${arrayPayload}.sig`)).toBeNull();
    const stringPayload = Buffer.from(JSON.stringify('hello')).toString('base64url');
    expect(decodeJwtPayload(`header.${stringPayload}.sig`)).toBeNull();
  });

  it('returns null for non-string inputs (defensive)', () => {
    expect(decodeJwtPayload(null as unknown as string)).toBeNull();
    expect(decodeJwtPayload(undefined as unknown as string)).toBeNull();
    expect(decodeJwtPayload('' as string)).toBeNull();
  });
});

describe('getUserIdFromJwtClaims', () => {
  it('reads user_id (modern, observed in 2026 production tokens)', () => {
    expect(getUserIdFromJwtClaims({ user_id: 11643235, generated_at: '2026-03-11 20:34:59' })).toBe(11643235);
  });

  it('reads user_ic (legacy, cited in older API docs samples)', () => {
    expect(getUserIdFromJwtClaims({ user_ic: 1256943, generated_at: '2017-06-07 09:17:29' })).toBe(1256943);
  });

  it('prefers user_id over user_ic when both are present', () => {
    expect(getUserIdFromJwtClaims({ user_id: 100, user_ic: 200 })).toBe(100);
  });

  it('returns null when neither claim is present', () => {
    expect(getUserIdFromJwtClaims({})).toBeNull();
    expect(getUserIdFromJwtClaims({ generated_at: '2026-01-01 00:00:00' })).toBeNull();
  });

  it('returns null when user_id is non-finite (NaN, Infinity)', () => {
    expect(getUserIdFromJwtClaims({ user_id: NaN })).toBeNull();
    expect(getUserIdFromJwtClaims({ user_id: Infinity })).toBeNull();
  });

  it('returns null when user_id is the wrong type (string, boolean, null)', () => {
    expect(getUserIdFromJwtClaims({ user_id: '123' })).toBeNull();
    expect(getUserIdFromJwtClaims({ user_id: true })).toBeNull();
    expect(getUserIdFromJwtClaims({ user_id: null })).toBeNull();
  });

  it('falls back to user_ic when user_id is invalid', () => {
    // user_id present but not a finite number — fall back to user_ic
    expect(getUserIdFromJwtClaims({ user_id: '123', user_ic: 456 })).toBe(456);
    expect(getUserIdFromJwtClaims({ user_id: NaN, user_ic: 789 })).toBe(789);
  });
});

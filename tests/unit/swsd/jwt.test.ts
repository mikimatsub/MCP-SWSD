import { describe, it, expect } from 'vitest';
import { decodeJwtPayload } from '../../../src/swsd/jwt.js';

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

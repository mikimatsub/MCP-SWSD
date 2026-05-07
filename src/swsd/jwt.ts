/**
 * Decode the payload (claims) of a JWT WITHOUT verifying the signature.
 *
 * SWSD tokens are HS512-signed JWTs issued by the user's tenant. We never
 * verify the signature locally — that's the upstream API's job — we just
 * read the claims to extract the authenticated user's id.
 *
 * Returns the parsed JSON object on success, or null on any failure
 * (malformed JWT, invalid base64, non-JSON payload, non-object payload).
 *
 * Common claims found in SWSD tokens:
 *   - user_ic: number — the authenticated user's numeric ID. NOTE the
 *     verbatim spelling "user_ic" (looks like a typo for "user_id" but
 *     the API docs ship it as-is).
 *   - generated_at: string — when the token was issued.
 *   - (ESM tenants may include additional claims like service_provider_id;
 *     we surface ALL claims so callers can use them.)
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  if (typeof jwt !== 'string' || jwt.length === 0) return null;
  const segments = jwt.split('.');
  if (segments.length !== 3) return null;
  const payloadSegment = segments[1];
  if (payloadSegment === undefined || payloadSegment.length === 0) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(payloadSegment, 'base64url').toString('utf-8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

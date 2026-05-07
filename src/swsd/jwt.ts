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
 *   - user_id (modern, observed in 2026 production tokens) OR user_ic
 *     (legacy / cited verbatim in older API docs samples) — the
 *     authenticated user's numeric ID. Use getUserIdFromJwtClaims()
 *     to read whichever is present.
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

/**
 * Extract the authenticated user's numeric ID from decoded JWT claims.
 *
 * SWSD's API docs sample (circa 2017, still present at apidoc.samanage.com)
 * shows the claim as `user_ic` — but production 2026 tokens use `user_id`.
 * Smoke testing live in May 2026 against api.samanage.com confirmed
 * `user_id`. This helper tries `user_id` first (modern) and falls back
 * to `user_ic` (legacy / docs sample) for backward compatibility with
 * any tenant that may still issue tokens in the older shape.
 *
 * Returns the numeric ID, or null if neither claim is present and finite.
 */
export function getUserIdFromJwtClaims(
  claims: Record<string, unknown>,
): number | null {
  const userId = claims.user_id;
  if (typeof userId === 'number' && Number.isFinite(userId)) return userId;
  const userIc = claims.user_ic;
  if (typeof userIc === 'number' && Number.isFinite(userIc)) return userIc;
  return null;
}

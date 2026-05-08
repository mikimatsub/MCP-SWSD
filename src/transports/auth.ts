import type { Request } from 'express';

const BEARER_PREFIX = 'Bearer ';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Extract the SWSD token from an HTTP request.
 *
 * Implementation note: this is hot-path code (runs on every HTTP request) and
 * the input is fully attacker-controlled. We deliberately avoid regular
 * expressions on the Authorization header. A polynomial-backtracking regex
 * (e.g. `/^Bearer\s+(.+)$/i` with greedy `\s+` that overlaps `(.+)` because
 * `.` matches whitespace) lets an attacker tie up a worker thread by sending
 * `Bearer ` followed by many spaces — see CodeQL `js/polynomial-redos`.
 *
 * Linear-time parsing:
 *   1. Case-insensitive prefix check (slice + toLowerCase, both O(n))
 *   2. Trim trailing whitespace once (O(n))
 *   3. Reject empty token (so a header of just `Bearer    ` errors out
 *      cleanly rather than passing an empty string downstream).
 */
export function extractToken(req: Request): string {
  const auth = req.header('authorization');
  if (auth) {
    // Case-insensitive prefix match without regex backtracking risk.
    if (auth.length > BEARER_PREFIX.length &&
        auth.slice(0, BEARER_PREFIX.length).toLowerCase() === BEARER_PREFIX.toLowerCase()) {
      const token = auth.slice(BEARER_PREFIX.length).trim();
      if (token.length > 0) return token;
    }
  }

  // Fallback: X-SWSD-Token (for Copilot custom connectors that can't preserve Authorization)
  const xToken = req.header('x-swsd-token');
  if (xToken) {
    const trimmed = xToken.trim();
    if (trimmed.length > 0) return trimmed;
  }

  throw new AuthError(
    'Missing token. Provide either "Authorization: Bearer <token>" or "X-SWSD-Token: <token>" header.',
  );
}

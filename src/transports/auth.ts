import type { Request } from 'express';

const BEARER_RE = /^Bearer\s+(.+)$/i;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function extractToken(req: Request): string {
  // Prefer Authorization: Bearer <token>
  const auth = req.header('authorization');
  if (auth) {
    const match = auth.match(BEARER_RE);
    if (match && match[1]) return match[1].trim();
  }

  // Fallback: X-SWSD-Token (for Copilot custom connectors that can't preserve Authorization)
  const xToken = req.header('x-swsd-token');
  if (xToken) return xToken.trim();

  throw new AuthError(
    'Missing token. Provide either "Authorization: Bearer <token>" or "X-SWSD-Token: <token>" header.',
  );
}

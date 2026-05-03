import { createHash } from 'node:crypto';
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import rateLimit from 'express-rate-limit';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Env } from '../config/env.js';
import { createMcpServer, SERVER_NAME, SERVER_VERSION } from '../mcp/server.js';
import { createSwsdClient } from '../swsd/client.js';
import { registerTools } from '../config/toolRegistry.js';
import { extractToken, AuthError } from './auth.js';

// MCP protocol versions known to work with SDK 1.29.x.
// When upgrading the SDK, re-check the spec versions it supports.
const SUPPORTED_PROTOCOL_VERSIONS = new Set<string>([
  '2024-11-05',
  '2025-03-26',
  '2025-06-18',
  '2025-11-25',
]);

export async function runHttp(env: Env): Promise<void> {
  const app = express();

  // Trust upstream proxy hops so req.ip reflects the real client (not the
  // proxy). Required for accurate rate-limit keying behind Azure App Service,
  // Nginx, Cloudflare, etc. Default false = no proxy (single instance dev).
  app.set('trust proxy', env.SWSD_TRUST_PROXY);

  app.use(express.json({ limit: '4mb' }));

  // Health endpoint — minimal payload (no version disclosure), separate
  // from /mcp so monitoring doesn't auth-fail and so health probes don't
  // count against the rate limit.
  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Rate limit /mcp only. Keyed by sha256(token+IP) so each user-on-IP gets
  // their own quota. Token is hashed (never stored as raw key) for memory
  // safety. Falls back to IP-only when no token is present (which would 401
  // anyway, but throttles brute-force attempts).
  const mcpLimiter = rateLimit({
    windowMs: env.SWSD_RATE_LIMIT_WINDOW_MS,
    limit: env.SWSD_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      const auth = req.header('authorization') ?? req.header('x-swsd-token') ?? '';
      const ip = req.ip ?? '0.0.0.0';
      return createHash('sha256').update(`${auth}:${ip}`).digest('hex');
    },
    message: { error: 'Too many requests. Slow down and try again later.' },
  });
  app.use('/mcp', mcpLimiter);

  // Origin validation — spec MUST for DNS-rebinding prevention.
  // Empty allowlist disables the check (acceptable behind a trusted reverse proxy).
  const allowedOrigins = new Set(env.SWSD_ALLOWED_ORIGINS);
  app.use('/mcp', (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin');
    if (origin && allowedOrigins.size > 0 && !allowedOrigins.has(origin)) {
      res.status(403).json({ error: `Origin ${origin} not allowed.` });
      return;
    }
    next();
  });

  // MCP-Protocol-Version header validation when present.
  app.use('/mcp', (req: Request, res: Response, next: NextFunction) => {
    const v = req.header('mcp-protocol-version');
    if (v && !SUPPORTED_PROTOCOL_VERSIONS.has(v)) {
      res.status(400).json({
        error: `Unsupported MCP-Protocol-Version: ${v}.`,
        supported: [...SUPPORTED_PROTOCOL_VERSIONS],
      });
      return;
    }
    next();
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    let token: string;
    try {
      token = extractToken(req);
    } catch (e) {
      if (e instanceof AuthError) {
        res.status(401).json({ error: e.message });
        return;
      }
      throw e;
    }

    const client = createSwsdClient({ env, token });
    const server = createMcpServer();
    const enabledTools: string[] = [];
    registerTools(server, {
      env,
      profile: env.SWSD_PROFILE,
      client,
      enabledTools,
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body as unknown);
  });

  app.listen(env.PORT, () => {
    process.stderr.write(
      `${SERVER_NAME} ${SERVER_VERSION} HTTP transport listening on :${String(env.PORT)} ` +
        `(POST /mcp, GET /healthz; rate limit ${String(env.SWSD_RATE_LIMIT_MAX)}/` +
        `${String(env.SWSD_RATE_LIMIT_WINDOW_MS / 1000)}s, request timeout ${String(env.SWSD_REQUEST_TIMEOUT_MS / 1000)}s)\n`,
    );
  });
}

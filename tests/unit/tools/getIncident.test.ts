import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetIncident } from '../../../src/tools/incidents/getIncident.js';
import type { ToolContext } from '../../../src/config/toolRegistry.js';
import type {
  SwsdClient,
  SwsdGetResult,
} from '../../../src/swsd/client.js';

interface RegisteredToolInternals {
  description?: string;
  annotations?: Record<string, unknown>;
  inputSchema?: unknown;
  handler: (input: unknown, extra: unknown) => Promise<unknown>;
}

interface McpServerInternals {
  _registeredTools: Record<string, RegisteredToolInternals>;
}

interface CapturedGet {
  type: 'get';
  path: string;
  params: Record<string, unknown>;
}

type CapturedCall = CapturedGet;

interface FakeClient extends SwsdClient {
  calls: CapturedCall[];
  setBodyForPath: (matcher: (path: string) => boolean, body: unknown) => void;
}

/**
 * Mock client that lets the test set per-path response bodies. The resolver
 * issues `GET /incidents.json?query=N` for number lookups, then the tool
 * issues `GET /incidents/{id}.json` for the actual fetch — so we need
 * different responses for those two paths.
 */
function makeFakeClient(): FakeClient {
  const calls: CapturedCall[] = [];
  const responders: Array<{ matcher: (p: string) => boolean; body: unknown }> = [];

  const get = async <T>(
    path: string,
    params: Record<string, unknown> = {},
  ): Promise<SwsdGetResult<T>> => {
    calls.push({ type: 'get', path, params });
    const responder = responders.find((r) => r.matcher(path));
    return {
      body: (responder?.body ?? null) as T,
      pagination: {
        page: 1,
        per_page: 25,
        total: undefined,
        has_more: false,
        next_page: undefined,
      },
      headers: new Headers(),
    };
  };
  const notImpl = async <T>(): Promise<T> => {
    throw new Error('not implemented in fake');
  };
  return {
    calls,
    setBodyForPath: (matcher, body) => {
      responders.push({ matcher, body });
    },
    get,
    post: notImpl,
    put: notImpl,
    rawRequest: notImpl,
  } as unknown as FakeClient;
}

function makeCtx(client: SwsdClient): ToolContext {
  return {
    client,
    profile: 'agent',
    env: {} as never,
    enabledTools: [],
    token: '',
  } satisfies ToolContext;
}

function getRegisteredTool(server: McpServer, name: string): RegisteredToolInternals {
  const internals = server as unknown as McpServerInternals;
  const t = internals._registeredTools[name];
  if (!t) throw new Error(`Tool ${name} not registered`);
  return t;
}

describe('swsd_get_incident — id_or_number resolution', () => {
  let server: McpServer;
  let client: FakeClient;
  let tool: RegisteredToolInternals;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeFakeClient();
    registerGetIncident(server, makeCtx(client));
    tool = getRegisteredTool(server, 'swsd_get_incident');
  });

  it('accepts a number reference and resolves to id before fetching', async () => {
    // The user passes the human-facing 5-digit number 60310. The resolver
    // must issue GET /incidents.json?query=60310 and then the actual fetch
    // must hit /incidents/180457930.json (the resolved id), NOT
    // /incidents/60310.json (which would 404 — see SWSD quirk in MEMORY.md).
    client.setBodyForPath(
      (p) => p === '/incidents.json',
      [{ id: 180457930, number: 60310, name: 'Sample ticket' }],
    );
    client.setBodyForPath(
      (p) => p === '/incidents/180457930.json',
      { id: 180457930, number: 60310, name: 'Sample ticket' },
    );

    await tool.handler({ id: 60310, detail_level: 'short' }, {});

    // 1) Resolver lookup — query=60310 against /incidents.json
    const lookup = client.calls[0];
    expect(lookup?.path).toBe('/incidents.json');
    expect(lookup?.params).toMatchObject({ query: 60310 });

    // 2) Actual fetch — uses the RESOLVED 9-digit id, not the input number
    const fetched = client.calls[1];
    expect(fetched?.path).toBe('/incidents/180457930.json');
  });

  it('passes 9-digit ids through without lookup', async () => {
    // The user passes 180457930 directly — this is already an id (>=7 digits)
    // and should hit /incidents/180457930.json with NO preliminary lookup.
    client.setBodyForPath(
      (p) => p === '/incidents/180457930.json',
      { id: 180457930, number: 60310, name: 'Sample ticket' },
    );

    await tool.handler({ id: 180457930, detail_level: 'short' }, {});

    // No /incidents.json lookup should happen for an id-sized input.
    const lookup = client.calls.find((c) => c.path === '/incidents.json');
    expect(lookup).toBeUndefined();

    // Single direct fetch.
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.path).toBe('/incidents/180457930.json');
  });
});

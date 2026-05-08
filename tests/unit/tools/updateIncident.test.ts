import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerUpdateIncident } from '../../../src/tools/incidents/updateIncident.js';
import type { ToolContext } from '../../../src/config/toolRegistry.js';
import type {
  SwsdClient,
  SwsdGetResult,
  SwsdMutationResult,
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

interface CapturedPut {
  type: 'put';
  path: string;
  body: unknown;
}

type CapturedCall = CapturedGet | CapturedPut;

interface FakeClient extends SwsdClient {
  calls: CapturedCall[];
  setLookupBody: (b: unknown) => void;
  setPutResponse: (b: unknown) => void;
}

function makeFakeClient(): FakeClient {
  const calls: CapturedCall[] = [];
  let lookupBody: unknown = [];
  let putResponse: unknown = { id: 180457930, number: 60310, name: 'Updated' };

  const get = async <T>(
    path: string,
    params: Record<string, unknown> = {},
  ): Promise<SwsdGetResult<T>> => {
    calls.push({ type: 'get', path, params });
    return {
      body: lookupBody as T,
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

  const put = async <T>(
    path: string,
    body: unknown,
  ): Promise<SwsdMutationResult<T>> => {
    calls.push({ type: 'put', path, body });
    return {
      body: putResponse as T,
      headers: new Headers(),
      status: 200,
    };
  };

  const notImpl = async <T>(): Promise<T> => {
    throw new Error('not implemented in fake');
  };

  return {
    calls,
    setLookupBody: (b: unknown) => {
      lookupBody = b;
    },
    setPutResponse: (b: unknown) => {
      putResponse = b;
    },
    get,
    post: notImpl,
    put,
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

describe('swsd_update_incident — id_or_number resolution', () => {
  let server: McpServer;
  let client: FakeClient;
  let tool: RegisteredToolInternals;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeFakeClient();
    registerUpdateIncident(server, makeCtx(client));
    tool = getRegisteredTool(server, 'swsd_update_incident');
  });

  it('accepts a number reference and resolves to id before updating', async () => {
    client.setLookupBody([{ id: 180457930, number: 60310 }]);
    client.setPutResponse({ id: 180457930, number: 60310, name: 'Renamed' });

    await tool.handler({ id: 60310, name: 'Renamed' }, {});

    // 1) Resolver lookup against /incidents.json
    const lookup = client.calls.find((c) => c.type === 'get');
    expect(lookup?.path).toBe('/incidents.json');
    expect(lookup?.type === 'get' ? lookup.params : {}).toMatchObject({ query: 60310 });

    // 2) PUT must hit the resolved id, NOT the input number
    const put = client.calls.find((c) => c.type === 'put');
    expect(put?.path).toBe('/incidents/180457930.json');
  });

  it('passes 9-digit ids through without lookup', async () => {
    client.setPutResponse({ id: 180457930, number: 60310, name: 'Renamed' });

    await tool.handler({ id: 180457930, name: 'Renamed' }, {});

    // No GET /incidents.json lookup for id-sized input.
    const lookup = client.calls.find(
      (c) => c.type === 'get' && c.path === '/incidents.json',
    );
    expect(lookup).toBeUndefined();

    // PUT goes directly to the id.
    const put = client.calls.find((c) => c.type === 'put');
    expect(put?.path).toBe('/incidents/180457930.json');
  });
});

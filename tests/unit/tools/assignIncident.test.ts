import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAssignIncident } from '../../../src/tools/incidents/assignIncident.js';
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
  let putResponse: unknown = { id: 180457930, number: 60310 };

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

describe('swsd_assign_incident — id_or_number resolution', () => {
  let server: McpServer;
  let client: FakeClient;
  let tool: RegisteredToolInternals;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeFakeClient();
    registerAssignIncident(server, makeCtx(client));
    tool = getRegisteredTool(server, 'swsd_assign_incident');
  });

  it('resolves a 5-digit number reference to id before PUTing', async () => {
    client.setLookupBody([{ id: 180457930, number: 60310 }]);

    await tool.handler({ id: 60310, assignee_email: 'agent@example.com' }, {});

    const lookup = client.calls.find((c) => c.type === 'get');
    expect(lookup?.path).toBe('/incidents.json');
    expect(lookup?.type === 'get' ? lookup.params : {}).toMatchObject({
      query: 60310,
    });

    const put = client.calls.find((c) => c.type === 'put');
    expect(put?.path).toBe('/incidents/180457930.json');
  });
});

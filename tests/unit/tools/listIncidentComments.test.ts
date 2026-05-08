import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListIncidentComments } from '../../../src/tools/comments/listIncidentComments.js';
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
      body: (responder?.body ?? []) as T,
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

describe('swsd_list_incident_comments — id_or_number resolution', () => {
  let server: McpServer;
  let client: FakeClient;
  let tool: RegisteredToolInternals;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeFakeClient();
    registerListIncidentComments(server, makeCtx(client));
    tool = getRegisteredTool(server, 'swsd_list_incident_comments');
  });

  it('resolves a 5-digit number reference to id before listing comments', async () => {
    client.setBodyForPath(
      (p) => p === '/incidents.json',
      [{ id: 180457930, number: 60310 }],
    );
    client.setBodyForPath(
      (p) => p === '/incidents/180457930/comments.json',
      [],
    );

    await tool.handler({ incident_id: 60310, page: 1, per_page: 25 }, {});

    const lookup = client.calls.find((c) => c.path === '/incidents.json');
    expect(lookup).toBeDefined();
    expect(lookup?.params).toMatchObject({ query: 60310 });

    const list = client.calls.find(
      (c) => c.path === '/incidents/180457930/comments.json',
    );
    expect(list).toBeDefined();
  });
});

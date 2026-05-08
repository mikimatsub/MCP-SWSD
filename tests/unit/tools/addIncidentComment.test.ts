import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAddIncidentComment } from '../../../src/tools/comments/addIncidentComment.js';
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

interface CapturedPost {
  type: 'post';
  path: string;
  body: unknown;
}

type CapturedCall = CapturedGet | CapturedPost;

interface FakeClient extends SwsdClient {
  calls: CapturedCall[];
  setLookupBody: (b: unknown) => void;
  setPostResponse: (b: unknown) => void;
}

function makeFakeClient(): FakeClient {
  const calls: CapturedCall[] = [];
  let lookupBody: unknown = [];
  let postResponse: unknown = {
    id: 88888,
    body: 'comment text',
    is_private: false,
  };

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

  const post = async <T>(
    path: string,
    body: unknown,
  ): Promise<SwsdMutationResult<T>> => {
    calls.push({ type: 'post', path, body });
    return {
      body: postResponse as T,
      headers: new Headers(),
      status: 201,
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
    setPostResponse: (b: unknown) => {
      postResponse = b;
    },
    get,
    post,
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

describe('swsd_add_incident_comment — id_or_number resolution', () => {
  let server: McpServer;
  let client: FakeClient;
  let tool: RegisteredToolInternals;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeFakeClient();
    registerAddIncidentComment(server, makeCtx(client));
    tool = getRegisteredTool(server, 'swsd_add_incident_comment');
  });

  it('accepts a number reference and resolves to id before posting', async () => {
    client.setLookupBody([{ id: 180457930, number: 60310 }]);
    client.setPostResponse({ id: 88888, body: 'Hello!', is_private: false });

    await tool.handler({ incident_id: 60310, body: 'Hello!', is_private: false }, {});

    // 1) Resolver lookup
    const lookup = client.calls.find((c) => c.type === 'get');
    expect(lookup?.path).toBe('/incidents.json');
    expect(lookup?.type === 'get' ? lookup.params : {}).toMatchObject({
      query: 60310,
    });

    // 2) POST hits the RESOLVED id's comments endpoint
    const post = client.calls.find((c) => c.type === 'post');
    expect(post?.path).toBe('/incidents/180457930/comments.json');
  });

  it('passes 9-digit ids through without lookup', async () => {
    client.setPostResponse({ id: 88888, body: 'Hello!', is_private: false });

    await tool.handler(
      { incident_id: 180457930, body: 'Hello!', is_private: false },
      {},
    );

    // No /incidents.json GET should happen.
    const lookup = client.calls.find(
      (c) => c.type === 'get' && c.path === '/incidents.json',
    );
    expect(lookup).toBeUndefined();

    // POST goes directly.
    const post = client.calls.find((c) => c.type === 'post');
    expect(post?.path).toBe('/incidents/180457930/comments.json');
  });
});

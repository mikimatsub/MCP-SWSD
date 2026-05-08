import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerLinkSolutionToIncident } from '../../../src/tools/incidents/linkSolutionToIncident.js';
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
  setBodyForPath: (matcher: (path: string) => boolean, body: unknown) => void;
  setPutResponse: (b: unknown) => void;
}

/**
 * The link-solution flow has FOUR client calls when both refs are numbers:
 *   1. GET /incidents.json?query=N    (incident resolver)
 *   2. GET /solutions.json?query=M    (solution resolver)
 *   3. GET /incidents/{id}.json       (read-before-link)
 *   4. PUT /incidents/{id}.json       (the link)
 * Tests need different bodies for the two resolver calls vs the read.
 */
function makeFakeClient(): FakeClient {
  const calls: CapturedCall[] = [];
  const responders: Array<{ matcher: (p: string) => boolean; body: unknown }> = [];
  let putResponse: unknown = { id: 180457930, number: 60310 };

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
    setBodyForPath: (matcher, body) => {
      responders.push({ matcher, body });
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

describe('swsd_link_solution_to_incident — id_or_number resolution for BOTH refs', () => {
  let server: McpServer;
  let client: FakeClient;
  let tool: RegisteredToolInternals;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeFakeClient();
    registerLinkSolutionToIncident(server, makeCtx(client));
    tool = getRegisteredTool(server, 'swsd_link_solution_to_incident');
  });

  it('resolves both incident_id and solution_id from numbers before linking', async () => {
    // Resolver responses
    client.setBodyForPath(
      (p) => p === '/incidents.json',
      [{ id: 180457930, number: 60310 }],
    );
    client.setBodyForPath(
      (p) => p === '/solutions.json',
      [{ id: 1849839, number: 397 }],
    );
    // Read-before-link response — incident exists, no existing linked solutions
    client.setBodyForPath(
      (p) => p === '/incidents/180457930.json',
      { id: 180457930, number: 60310, solutions: [] },
    );
    client.setPutResponse({
      id: 180457930,
      number: 60310,
      solutions: [{ id: 1849839, href: 'x' }],
    });

    await tool.handler({ incident_id: 60310, solution_id: 397 }, {});

    // Both lookups happen
    const incidentLookup = client.calls.find(
      (c) => c.type === 'get' && c.path === '/incidents.json',
    );
    const solutionLookup = client.calls.find(
      (c) => c.type === 'get' && c.path === '/solutions.json',
    );
    expect(incidentLookup).toBeDefined();
    expect(solutionLookup).toBeDefined();
    expect(
      incidentLookup?.type === 'get' ? incidentLookup.params : {},
    ).toMatchObject({ query: 60310 });
    expect(
      solutionLookup?.type === 'get' ? solutionLookup.params : {},
    ).toMatchObject({ query: 397 });

    // Read-before-link uses RESOLVED incident id
    const read = client.calls.find(
      (c) => c.type === 'get' && c.path === '/incidents/180457930.json',
    );
    expect(read).toBeDefined();

    // PUT uses RESOLVED incident id and includes the RESOLVED solution id
    const put = client.calls.find((c) => c.type === 'put');
    expect(put?.path).toBe('/incidents/180457930.json');
    if (!put || put.type !== 'put') throw new Error('put missing');
    const body = put.body as { incident: { solution_ids: number[] } };
    expect(body.incident.solution_ids).toContain(1849839);
  });
});

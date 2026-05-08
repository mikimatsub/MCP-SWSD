import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListMyIncidents } from '../../../src/tools/incidents/listMyIncidents.js';
import {
  makeFakeClient,
  getRegisteredTool,
  type FakeClient,
  type RegisteredToolInternals,
} from './_helpers/mockClient.js';
import type { ToolContext } from '../../../src/config/toolRegistry.js';

/**
 * End-to-end alias-translation tests for swsd_list_my_incidents.
 *
 * Same shape as listIncidents.test.ts but the handler also performs a
 * JWT decode + a /users/{id}.json lookup before issuing the incidents query.
 * We construct a synthetic JWT with `user_id: 42` and configure the fake
 * client to return a user record for that id, so the second GET (the
 * incidents query) is the one whose params we assert on.
 */

// Build a JWT with payload { user_id: 42 } - signature is opaque (not verified).
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS512' })).toString('base64url');
const PAYLOAD = Buffer.from(JSON.stringify({ user_id: 42, generated_at: '2026-05-07' })).toString(
  'base64url',
);
const TEST_JWT = `${HEADER}.${PAYLOAD}.signature`;

function makeCtxWithJwt(client: FakeClient): ToolContext {
  return {
    client,
    profile: 'agent',
    env: {} as never,
    enabledTools: [],
    token: TEST_JWT,
  } satisfies ToolContext;
}

describe('swsd_list_my_incidents - updated_within alias', () => {
  let server: McpServer;
  let client: FakeClient;
  let tool: RegisteredToolInternals;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeFakeClient();
    registerListMyIncidents(server, makeCtxWithJwt(client));
    tool = getRegisteredTool(server, 'swsd_list_my_incidents');

    // /users/42.json returns the authenticated user; everything else returns [].
    client.setBodyForPath(
      (path) => path === '/users/42.json',
      { id: 42, email: 'me@example.com' },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('translates updated_within to updated_at greater_than before sending', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'));

    await tool.handler({ page: 1, per_page: 25, updated_within: '7d' }, {});

    const get = client.calls.find((c) => c.type === 'get' && c.path === '/incidents.json');
    expect(get).toBeDefined();
    const params = get?.type === 'get' ? get.params : {};
    expect(params.updated_at).toEqual(['greater_than', '2026-04-30']);
    // assignee_email is set internally by this tool.
    expect(params.assignee_email).toBe('me@example.com');
    expect(params).not.toHaveProperty('updated_within');
  });

  it('respects explicit updated_from over updated_within', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'));

    await tool.handler(
      {
        page: 1,
        per_page: 25,
        updated_within: '7d',
        updated_from: '2026-01-01',
      },
      {},
    );

    const get = client.calls.find((c) => c.type === 'get' && c.path === '/incidents.json');
    const params = get?.type === 'get' ? get.params : {};
    expect(params.updated_at).toEqual(['greater_than', '2026-01-01']);
    expect(params).not.toHaveProperty('updated_within');
  });
});

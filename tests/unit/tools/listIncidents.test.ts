import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListIncidents } from '../../../src/tools/incidents/listIncidents.js';
import {
  makeFakeClient,
  makeCtx,
  getRegisteredTool,
  type FakeClient,
  type RegisteredToolInternals,
} from './_helpers/mockClient.js';

/**
 * End-to-end alias-translation tests for swsd_list_incidents.
 *
 * Asserts:
 *   1. `updated_within: '7d'` becomes `updated_at: ['greater_than', '<7-days-ago>']`
 *      in the GET params (the SWSD wire shape for `updated_from`).
 *   2. `updated_within` is NOT forwarded to the underlying client.
 *   3. Explicit `updated_from` wins over `updated_within` (no override).
 */
describe('swsd_list_incidents - updated_within alias', () => {
  let server: McpServer;
  let client: FakeClient;
  let tool: RegisteredToolInternals;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeFakeClient();
    registerListIncidents(server, makeCtx(client));
    tool = getRegisteredTool(server, 'swsd_list_incidents');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('translates updated_within to updated_at greater_than before sending', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'));

    await tool.handler(
      { page: 1, per_page: 25, updated_within: '7d' },
      {},
    );

    const get = client.calls.find((c) => c.type === 'get' && c.path === '/incidents.json');
    expect(get).toBeDefined();
    const params = get?.type === 'get' ? get.params : {};
    expect(params.updated_at).toEqual(['greater_than', '2026-04-30']);
    // updated_within is internal-only and must not leak to SWSD.
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
    // The explicit value wins - NOT the 7-days-ago value.
    expect(params.updated_at).toEqual(['greater_than', '2026-01-01']);
    expect(params).not.toHaveProperty('updated_within');
  });
});

import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetIncident } from '../../../src/tools/incidents/getIncident.js';
import type { ToolContext } from '../../../src/config/toolRegistry.js';

/**
 * The plan (Task 1 API discovery, lines 96-110) records that ext-apps@1.7.1
 * stores the UI metadata at `registeredTool._meta.ui.resourceUri` (preferred)
 * and `registeredTool._meta["ui/resourceUri"]` (deprecated mirror, kept for
 * back-compat). We assert both — if either ever drops out we want a regression
 * signal.
 *
 * `McpServer` exposes registered tools on the (private) `_registeredTools`
 * record keyed by tool name. We reach into it with a typed cast — the same
 * pattern the upstream SDK's own tests use.
 */
interface RegisteredToolWithUi {
  _meta?: {
    ui?: { resourceUri?: unknown };
    'ui/resourceUri'?: unknown;
    [key: string]: unknown;
  };
}

interface McpServerInternals {
  _registeredTools: Record<string, RegisteredToolWithUi>;
}

describe('swsd_get_incident UI registration', () => {
  it("attaches a ui:// resourceUri to the registered tool's _meta", () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    const ctx = {
      client: {} as never,
      profile: 'minimal' as never,
      env: {} as never,
      enabledTools: [],
      token: '',
    } satisfies ToolContext;

    registerGetIncident(server, ctx);

    const internals = server as unknown as McpServerInternals;
    const incident = internals._registeredTools['swsd_get_incident'];
    expect(incident).toBeDefined();

    // Modern shape: _meta.ui.resourceUri
    const modernUri = incident._meta?.ui?.resourceUri;
    expect(typeof modernUri).toBe('string');
    expect(modernUri).toMatch(/^ui:\/\//);

    // Legacy mirror written by registerAppTool for older hosts.
    const legacyUri = incident._meta?.['ui/resourceUri'];
    expect(typeof legacyUri).toBe('string');
    expect(legacyUri).toBe(modernUri);
  });
});

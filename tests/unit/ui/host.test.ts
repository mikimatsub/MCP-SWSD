import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for `mountApp` tool-result + error handling.
 *
 * `mountApp` constructs an `App` from `@modelcontextprotocol/ext-apps`,
 * subscribes to its `'toolresult'` event, and routes the notification to
 * `onResult` (success) or `onError` (when `params.isError === true`).
 *
 * The whole `@modelcontextprotocol/ext-apps` module is mocked at the import
 * boundary so the tests stay framework-agnostic — we don't need a real
 * `PostMessageTransport`, `connect()` handshake, or the Zod schemas the
 * SDK ships with. The `FakeApp` records subscribed handlers so a test can
 * synthesize a `toolresult` notification by calling `fireToolResult(params)`.
 *
 * Style helpers (`applyDocumentTheme`, `applyHostStyleVariables`,
 * `applyHostFonts`) are stubbed to no-ops because the success path in the
 * post-`connect()` block calls `getHostContext()` then forwards to them.
 */

type Handler = (params: unknown) => void;

interface FakeAppHandle {
  addEventListener(event: string, handler: Handler): void;
  connect(): Promise<void>;
  getHostContext(): undefined;
  fireToolResult(params: unknown): void;
  fireHostContextChanged(params: unknown): void;
}

function createFakeApp(): FakeAppHandle {
  const handlers: Record<string, Handler[]> = {};
  return {
    addEventListener(event, handler) {
      (handlers[event] ??= []).push(handler);
    },
    async connect() {
      // no-op — the real handshake is not exercised here.
    },
    getHostContext() {
      return undefined;
    },
    fireToolResult(params) {
      for (const h of handlers['toolresult'] ?? []) h(params);
    },
    fireHostContextChanged(params) {
      for (const h of handlers['hostcontextchanged'] ?? []) h(params);
    },
  };
}

let lastApp: FakeAppHandle | undefined;

vi.mock('@modelcontextprotocol/ext-apps', () => ({
  // `App` is a real class in the SDK — JS-call with `new App(...)` requires
  // a constructible mock, so use a plain function that stores the handle.
  App: function MockApp() {
    lastApp = createFakeApp();
    return lastApp;
  } as unknown as new () => FakeAppHandle,
  applyDocumentTheme: vi.fn(),
  applyHostStyleVariables: vi.fn(),
  applyHostFonts: vi.fn(),
}));

beforeEach(() => {
  lastApp = undefined;
  vi.clearAllMocks();
});

// Imported AFTER vi.mock so the host module picks up the mocked App.
const { mountApp } = await import('../../../src/ui/shared/host.js');

describe('mountApp — toolresult routing', () => {
  it('calls onError when tool-result has isError: true and extracts the text message', async () => {
    const onResult = vi.fn();
    const onError = vi.fn();
    await mountApp({ name: 'test', version: '0.0.0', onResult, onError });
    expect(lastApp).toBeDefined();
    lastApp!.fireToolResult({
      isError: true,
      content: [{ type: 'text', text: 'Incident 99999 not found' }],
      structuredContent: undefined,
    });
    expect(onError).toHaveBeenCalledWith({
      message: 'Incident 99999 not found',
      structuredContent: undefined,
    });
    expect(onResult).not.toHaveBeenCalled();
  });

  it('calls onResult on success (regression — happy path stays intact)', async () => {
    const onResult = vi.fn();
    const onError = vi.fn();
    await mountApp<{ incidents: unknown[] }>({
      name: 'test',
      version: '0.0.0',
      onResult,
      onError,
    });
    lastApp!.fireToolResult({
      isError: false,
      content: [],
      structuredContent: { incidents: [] },
    });
    expect(onResult).toHaveBeenCalledWith({ incidents: [] });
    expect(onError).not.toHaveBeenCalled();
  });

  it('falls back to a generic error message when isError is true and content is empty', async () => {
    const onError = vi.fn();
    await mountApp({
      name: 'test',
      version: '0.0.0',
      onResult: vi.fn(),
      onError,
    });
    lastApp!.fireToolResult({ isError: true, content: [], structuredContent: undefined });
    expect(onError).toHaveBeenCalledWith({
      message: 'The tool reported an error but did not provide a message.',
      structuredContent: undefined,
    });
  });

  it('forwards structuredContent on isError so widgets can offer richer error UIs', async () => {
    const onError = vi.fn();
    await mountApp({
      name: 'test',
      version: '0.0.0',
      onResult: vi.fn(),
      onError,
    });
    const sc = { code: 'NOT_FOUND', detail: 'no such incident' };
    lastApp!.fireToolResult({
      isError: true,
      content: [{ type: 'text', text: 'Incident not found' }],
      structuredContent: sc,
    });
    expect(onError).toHaveBeenCalledWith({
      message: 'Incident not found',
      structuredContent: sc,
    });
  });

  it('does not call onResult when structuredContent is undefined and isError is not set (text-only fallback)', async () => {
    const onResult = vi.fn();
    await mountApp({ name: 'test', version: '0.0.0', onResult });
    lastApp!.fireToolResult({
      content: [{ type: 'text', text: 'Just a status update' }],
      structuredContent: undefined,
    });
    expect(onResult).not.toHaveBeenCalled();
  });

  it('warns to the console when isError fires but no onError handler was provided', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onResult = vi.fn();
    await mountApp({ name: 'test', version: '0.0.0', onResult });
    lastApp!.fireToolResult({
      isError: true,
      content: [{ type: 'text', text: 'Boom' }],
      structuredContent: undefined,
    });
    expect(onResult).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

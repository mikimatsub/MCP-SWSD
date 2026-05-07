/**
 * MCP Apps host integration via the canonical `App` class.
 *
 * Per spec 2026-01-26 ("MCP Apps", SEP-1865, Final), view ↔ host
 * communication is JSON-RPC 2.0 over `postMessage`. The handshake is:
 *
 *   1. View sends `ui/initialize` request with appInfo + capabilities
 *   2. Host responds with `McpUiInitializeResult`
 *   3. View sends `ui/notifications/initialized` notification
 *   4. Host then sends `ui/notifications/tool-input` (once) and
 *      `ui/notifications/tool-result` (once), and `ui/notifications/host-context-changed`
 *      whenever theme/locale/etc. change.
 *
 * `@modelcontextprotocol/ext-apps`'s `App` class handles the entire
 * handshake; we just register listeners (BEFORE calling `connect()` so
 * notifications aren't missed) and wait for the result.
 *
 * This module replaces the prior hand-rolled `{type:'init'}/{type:'ready'}`
 * shape, which was incompatible with strict spec hosts (VS Code Insiders
 * Copilot Chat, Claude Desktop, etc.) — the SDK's `PostMessageTransport`
 * silently drops messages without `jsonrpc: "2.0"`, so the prior shape
 * was invisible to every spec-compliant host.
 */

import { App, applyHostStyleVariables, applyDocumentTheme, applyHostFonts }
  from '@modelcontextprotocol/ext-apps';
import type {
  McpUiToolResultNotification,
  McpUiHostContextChangedNotification,
  McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';

/**
 * Mount an MCP App that consumes a single tool-result and renders it.
 *
 * Creates the `App`, wires listeners for `toolresult` and `hostcontextchanged`
 * (so theme + style tokens flow into the document root), then calls
 * `connect()` which performs the spec's `ui/initialize` handshake.
 *
 * @param opts.name     App slug for host logs (e.g. "swsd-mcp/incident-detail").
 * @param opts.version  App version (typically the npm package version).
 * @param opts.onResult Called with `params.structuredContent` whenever the
 *                      host pushes `ui/notifications/tool-result`. Type
 *                      parameter `T` is the expected `structuredContent`
 *                      shape (e.g. `{incident: {...}}`).
 *
 * @returns the connected `App` instance (so callers can attach further
 *          listeners or call `app.callServerTool(...)` if they want).
 */
export async function mountApp<T>(opts: {
  name: string;
  version: string;
  onResult: (structuredContent: T) => void;
}): Promise<App> {
  const app = new App({ name: opts.name, version: opts.version });

  // Register BEFORE connect() so the spec-mandated initial tool-result
  // (sent immediately after the host receives `ui/notifications/initialized`)
  // isn't missed by a late-bound listener.
  app.addEventListener(
    'toolresult',
    (params: McpUiToolResultNotification['params']) => {
      const sc = params.structuredContent;
      if (sc !== undefined) {
        opts.onResult(sc as T);
      }
      // If structuredContent is absent, the widget stays in its initial
      // empty state — preserves the spec's text-only fallback contract
      // for hosts that round-trip results without structured payloads.
    },
  );

  app.addEventListener(
    'hostcontextchanged',
    (params: McpUiHostContextChangedNotification['params']) => {
      applyHostContextStyling(params);
    },
  );

  // Default transport: PostMessageTransport(window.parent, window).
  // The SDK auto-handles `ui/initialize` → `McpUiInitializeResult` →
  // `ui/notifications/initialized` here.
  await app.connect();

  // After connect resolves, the initial host context is available via
  // getHostContext(). Apply theme + style vars synchronously so the
  // widget's first paint already reflects the host's chrome.
  const ctx = app.getHostContext();
  if (ctx) {
    applyHostContextStyling(ctx);
  }

  return app;
}

/**
 * Apply host-context-driven CSS theming.
 *
 * Forwards `theme` to {@link applyDocumentTheme} (sets `data-theme` +
 * `color-scheme`), `styles.variables` to {@link applyHostStyleVariables}
 * (sets CSS custom properties), and `styles.fonts` to {@link applyHostFonts}.
 *
 * Each branch is a no-op if its source field is absent — partial host-context
 * updates (the common case for `ui/notifications/host-context-changed`) are
 * handled correctly without wiping previously-applied tokens.
 */
function applyHostContextStyling(
  ctx: McpUiHostContext | McpUiHostContextChangedNotification['params'],
): void {
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
}

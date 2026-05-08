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
 * Options accepted by {@link mountApp}.
 *
 * `T` is the expected `structuredContent` shape on the success path. On the
 * error path the `structuredContent` (if any) is forwarded as `unknown` so
 * widgets that want a richer error UI than a plain text message can opt in
 * to deserializing it themselves.
 */
export interface MountAppOptions<T> {
  name: string;
  version: string;
  /** Called with `params.structuredContent` on a successful tool-result. */
  onResult: (structuredContent: T) => void;
  /**
   * Optional. Called when the host delivers a tool-result with `isError: true`.
   * `message` is the first text-content part of the result, or a generic
   * fallback when the host omits text. `structuredContent` is forwarded
   * verbatim (typically `undefined` on errors, but some servers populate it
   * with a typed error envelope).
   *
   * If unset and an error arrives, `mountApp` logs to `console.warn` so the
   * loading-spinner-forever bug is at least surfaced in dev tools.
   */
  onError?: (error: { message: string; structuredContent?: unknown }) => void;
}

/**
 * Mount an MCP App that consumes a single tool-result and renders it.
 *
 * Creates the `App`, wires listeners for `toolresult` and `hostcontextchanged`
 * (so theme + style tokens flow into the document root), then calls
 * `connect()` which performs the spec's `ui/initialize` handshake.
 *
 * Routes the `'toolresult'` notification to either `onResult` (success path,
 * when `params.structuredContent` is defined) or `onError` (when
 * `params.isError === true`). Without the error branch, widgets would hang
 * on their loading state forever any time a tool throws.
 *
 * @returns the connected `App` instance (so callers can attach further
 *          listeners or call `app.callServerTool(...)` if they want).
 */
export async function mountApp<T>(opts: MountAppOptions<T>): Promise<App> {
  const app = new App({ name: opts.name, version: opts.version });

  // Register BEFORE connect() so the spec-mandated initial tool-result
  // (sent immediately after the host receives `ui/notifications/initialized`)
  // isn't missed by a late-bound listener.
  app.addEventListener(
    'toolresult',
    (params: McpUiToolResultNotification['params']) => {
      // Error path takes precedence — a result with `isError: true` may
      // still carry a `structuredContent` envelope, but widgets must render
      // an error state, not the success view.
      if (params.isError) {
        const message =
          extractTextMessage(params.content) ??
          'The tool reported an error but did not provide a message.';
        if (opts.onError) {
          opts.onError({ message, structuredContent: params.structuredContent });
        } else {
          // Surface the error in dev tools so the symptom isn't silent
          // (the original bug — widgets stuck on "Loading…" forever).
          console.warn('[mountApp] tool-result error (no onError handler):', message);
        }
        return;
      }
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

/**
 * Extracts the first non-empty text-content part from a tool-result `content`
 * array. The MCP `CallToolResult.content` shape supports text/image/audio/
 * resource_link/resource parts; for the error UX we only care about the
 * human-readable text. Returns `undefined` when `content` is missing,
 * non-array, empty, or contains only non-text parts.
 */
function extractTextMessage(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const part of content) {
    if (
      part &&
      typeof part === 'object' &&
      'type' in part &&
      (part as { type: unknown }).type === 'text' &&
      'text' in part
    ) {
      const text = (part as { text: unknown }).text;
      if (typeof text === 'string' && text.length > 0) return text;
    }
  }
  return undefined;
}

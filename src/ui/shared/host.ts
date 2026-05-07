/**
 * Helpers for MCP Apps host integration.
 *
 * Wraps the postMessage init protocol (per spec 2025-11-25, "UI Resources" /
 * "App-Host Communication") so individual UIs can focus on rendering their
 * payload without hand-rolling message wiring.
 *
 * Lifecycle:
 *   1. The UI iframe loads. As soon as it's ready, it posts `{type: 'ready'}`
 *      back to the parent window.
 *   2. The host (Claude / VS Code Copilot / etc.) responds with
 *      `{type: 'init', data: <toolStructuredContent>, styles?: {...}}`.
 *   3. Subsequent re-renders from the same tool call may arrive as additional
 *      `init` messages — handlers should be idempotent.
 *
 * No origin check is enforced here: MCP Apps runs each iframe in a sandbox
 * with no relevant cross-frame attack surface (the iframe has no privileged
 * APIs and the parent posts to the iframe by reference, not by origin).
 * Treat the payload as the same data the tool already returned via
 * structuredContent — if you trust that, you trust this.
 */

export interface HostInitMessage<T = unknown> {
  type: 'init';
  data: T;
  /**
   * Optional theme tokens the host wants applied to the iframe. Each entry
   * becomes a CSS custom property on the document root via
   * `applyHostThemeVariables`.
   */
  styles?: { variables?: Record<string, string> };
}

/**
 * Subscribe to the host's `init` message and acknowledge readiness.
 *
 * Call this once at startup. The handler fires every time the host posts an
 * `init` message — typical hosts only post once, but resize/state-change
 * pathways may re-post the same shape, so handlers should be safe to call
 * repeatedly with the same data.
 */
export function onHostInit<T>(handler: (msg: HostInitMessage<T>) => void): void {
  window.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data as { type?: string };
    if (msg?.type === 'init') {
      handler(e.data as HostInitMessage<T>);
    }
  });
  // Tell the host we're mounted and ready to receive init.
  window.parent?.postMessage({ type: 'ready' }, '*');
}

/**
 * Apply theme tokens supplied by the host as CSS custom properties on
 * `document.documentElement`. No-ops if `vars` is undefined or empty.
 */
export function applyHostThemeVariables(
  vars: Record<string, string> | undefined,
): void {
  if (!vars) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

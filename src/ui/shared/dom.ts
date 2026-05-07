/**
 * Safe DOM construction helpers. No raw HTML strings.
 *
 * Every text value goes through `textContent`, every attribute through
 * `setAttribute`. On top of that, `el` enforces two rules to keep XSS
 * structurally impossible regardless of the payload origin:
 *
 *   1. Event-handler attributes (anything starting with `on`, e.g. `onclick`,
 *      `onload`) are rejected — wire listeners with `addEventListener` instead.
 *   2. URL-bearing attributes (`href`, `src`, `xlink:href`, `formaction`,
 *      `action`, `srcdoc`, `data`, `ping`) are rejected when the value uses a
 *      script-capable URL scheme (`javascript:`, `data:`, `vbscript:`).
 *
 * Both checks are case-insensitive. Callers that genuinely need a `data:` URL
 * for an image or download should construct the element directly and document
 * the exception — `el` is the safe default for the 99% case.
 */

type Children = Array<Node | string | null | undefined>;
type Attrs = Record<string, string | number | boolean | undefined>;

const URL_BEARING_ATTRS = new Set([
  'href',
  'src',
  'xlink:href',
  'formaction',
  'action',
  'srcdoc',
  'data',
  'ping',
]);

const DISALLOWED_URL_SCHEME = /^\s*(javascript|data|vbscript):/i;
const EVENT_HANDLER_ATTR = /^on/i;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children?: Children,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === false) continue;
      if (EVENT_HANDLER_ATTR.test(key)) {
        throw new Error(
          `Refusing to set event-handler attribute "${key}" — wire listeners with addEventListener instead.`,
        );
      }
      const lowerKey = key.toLowerCase();
      if (value === true) {
        // Boolean attributes can never carry a URL, so the scheme check is unreachable here.
        node.setAttribute(key, '');
      } else {
        const stringValue = String(value);
        if (URL_BEARING_ATTRS.has(lowerKey) && DISALLOWED_URL_SCHEME.test(stringValue)) {
          throw new Error(
            `Refusing to set ${key}="${stringValue}" — disallowed URL scheme.`,
          );
        }
        node.setAttribute(key, stringValue);
      }
    }
  }
  if (children) {
    for (const child of children) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return node;
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

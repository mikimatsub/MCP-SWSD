/**
 * Shared formatting helpers for UI scripts.
 *
 * Tool payloads land in the iframe as opaque `Record<string, unknown>` values
 * — flat-summary forms (mapped types like `IncidentSummary`) and the raw
 * passthrough forms (e.g. nested `{ category: { name } }`) coexist in the
 * same UI. Each helper is defensive: type-checks the value before returning
 * it, returns `undefined` rather than throwing, and never reaches into
 * arrays-as-objects.
 *
 * Co-locating these in one place keeps the per-UI scripts focused on render
 * logic and means there's one place to fix a bug like the protocol-relative
 * URL bypass in `isSafeHttpUrl`.
 */

/**
 * Read a string field from a payload object. Returns the string only when it
 * is non-empty; empty strings collapse to `undefined` so callers can use
 * `?? fallback` chains without an extra `length` check.
 */
export function pickString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Read a numeric field from a payload object. Returns the value only when it
 * is a finite number — `NaN`, `Infinity`, and non-numeric values (strings
 * containing digits, etc.) collapse to `undefined`.
 */
export function pickNumber(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Read a string field from a nested object (e.g. `category.name`). Returns
 * `undefined` if the parent is missing, is not a plain object, is an array,
 * or the child string is empty/missing.
 */
export function pickNestedString(
  obj: Record<string, unknown>,
  parentKey: string,
  childKey: string,
): string | undefined {
  const parent = obj[parentKey];
  if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
    const v = (parent as Record<string, unknown>)[childKey];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Format an ISO 8601 timestamp as a human-readable locale string. If the
 * input fails `Date` parsing the original string is returned untouched,
 * preferring "shows something raw" over "shows nothing" or "throws".
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * Defense in depth on top of the safe-DOM helper's URL-scheme check: only
 * approve a URL when it looks like an http(s) absolute URL or a same-origin
 * relative path. Anything else (including protocol-relative `//host/path`
 * URLs that the browser would silently resolve to `https://host/path`)
 * returns false so the caller can fall back to plain-text rendering.
 *
 * Order of checks matters: protocol-relative `//evil.com` must be rejected
 * BEFORE the single-leading-slash same-origin shortcut, otherwise a
 * `//evil.com/foo` URL would slip through.
 */
export function isSafeHttpUrl(url: string | undefined): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  const s = url.trim();
  if (s.startsWith('//')) return false; // reject protocol-relative URL bypass
  if (s.startsWith('/')) return true; // same-origin path
  return /^https?:\/\//i.test(s);
}

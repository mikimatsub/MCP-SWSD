/**
 * SWSD uses repeated-key array params (state[]=A&state[]=B), not comma joins.
 * This serializer handles arrays, primitives, Dates, and skips null/undefined.
 */
export function serializeQuery(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      const arrayKey = `${key}[]`;
      for (const item of value) {
        if (item === null || item === undefined) continue;
        parts.push(`${encodeURIComponent(arrayKey)}=${encodeURIComponent(stringify(item))}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(stringify(value))}`);
    }
  }
  return parts.join('&');
}

function stringify(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

import type { IncidentSummary, IncidentDetail } from '../types.js';

/**
 * Project a raw SWSD incident into a compact summary.
 * Keep this list short — list responses can return 25+ items, and every
 * extra field multiplies the token cost in the agent's context window.
 */
export function toIncidentSummary(raw: unknown): IncidentSummary | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;

  return {
    id,
    number: numberOrUndefined(raw.number),
    name: stringOrEmpty(raw.name),
    state: stringOrUndefined(raw.state),
    priority: stringOrUndefined(raw.priority),
    assignee_email: nestedString(raw.assignee, 'email'),
    requester_email: nestedString(raw.requester, 'email'),
    category: nestedString(raw.category, 'name'),
    updated_at: stringOrUndefined(raw.updated_at),
    url: stringOrUndefined(raw.href_account_domain),
  };
}

export function toIncidentDetail(raw: unknown): IncidentDetail | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;
  return { ...raw, id };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function numberOrUndefined(v: unknown): number | undefined {
  const n = numberOrNull(v);
  return n === null ? undefined : n;
}

function stringOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function stringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function nestedString(parent: unknown, key: string): string | undefined {
  if (!isPlainObject(parent)) return undefined;
  const v = parent[key];
  return typeof v === 'string' ? v : undefined;
}

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

export interface IncidentWriteFields {
  name?: string;
  description?: string;
  priority?: string;
  state?: string;
  assignee_email?: string;
  requester_email?: string;
  category_name?: string;
  site_name?: string;
  department_name?: string;
}

/**
 * Build the SWSD POST/PUT request body shape for incident create/update.
 * Only includes fields the caller explicitly provided.
 */
export function buildIncidentWritePayload(
  fields: IncidentWriteFields,
): { incident: Record<string, unknown> } {
  const incident: Record<string, unknown> = {};
  if (fields.name !== undefined) incident.name = fields.name;
  if (fields.description !== undefined) incident.description = fields.description;
  if (fields.priority !== undefined) incident.priority = fields.priority;
  if (fields.state !== undefined) incident.state = fields.state;
  if (fields.assignee_email !== undefined) incident.assignee = { email: fields.assignee_email };
  if (fields.requester_email !== undefined) incident.requester = { email: fields.requester_email };
  if (fields.category_name !== undefined) incident.category = { name: fields.category_name };
  if (fields.site_name !== undefined) incident.site = { name: fields.site_name };
  if (fields.department_name !== undefined) incident.department = { name: fields.department_name };
  return { incident };
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

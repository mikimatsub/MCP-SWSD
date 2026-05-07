import type { AuditSummary } from '../types.js';

/**
 * Project a raw SWSD audit entry into a compact summary.
 *
 * The canonical identifier is `uuid` (string) — SWSD's
 * /{object}/{id}/audits.json endpoint does not expose a numeric id.
 *
 * Strips department/site/hardware_href nested fields — those belong on the
 * parent record, not on each audit. Preserves empty-string note as distinct
 * from missing.
 */
export function toAuditSummary(raw: unknown): AuditSummary | null {
  if (!isPlainObject(raw)) return null;
  const uuid = nonEmptyStringOrNull(raw.uuid);
  if (uuid === null) return null;

  return {
    uuid,
    message: stringOrEmpty(raw.message),
    action: stringOrUndefined(raw.action),
    created_at: stringOrUndefined(raw.created_at),
    user: stringOrUndefined(raw.user),
    user_id: numberOrUndefined(raw.user_id),
    note: typeof raw.note === 'string' ? raw.note : undefined,
    source_type: stringOrUndefined(raw.source_type),
    source_id: numberOrUndefined(raw.source_id),
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonEmptyStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
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

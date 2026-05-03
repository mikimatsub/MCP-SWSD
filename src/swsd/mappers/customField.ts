import type { CustomFieldSummary } from '../types.js';

/**
 * Project a raw SWSD custom-field metadata object into a compact summary.
 * The raw response has ~18 fields per item; we keep the ones agents need
 * for "before-write validation" workflows.
 */
export function toCustomFieldSummary(raw: unknown): CustomFieldSummary | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;

  const valuesArray = Array.isArray(raw.values_array)
    ? raw.values_array
        .map((v) => (typeof v === 'string' ? v : null))
        .filter((v): v is string => v !== null)
    : [];

  return {
    id,
    name: stringOrEmpty(raw.name),
    type: stringOrEmpty(raw.field_type_name) || 'Unknown',
    required: typeof raw.required === 'boolean' ? raw.required : false,
    active: typeof raw.active === 'boolean' ? raw.active : false,
    scope: stringOrUndefined(raw.scope_string),
    module: stringOrUndefined(raw.module),
    values: valuesArray.length > 0 ? valuesArray : undefined,
    help_text: stringOrUndefined(raw.help_text),
    searchable:
      typeof raw.searchable_state === 'boolean' ? raw.searchable_state : false,
  };
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

function stringOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function stringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

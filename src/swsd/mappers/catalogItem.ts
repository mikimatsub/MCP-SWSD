import type {
  CatalogItemSummary,
  CatalogItemDetail,
  CatalogItemVariable,
} from '../types.js';

export function toCatalogItemSummary(raw: unknown): CatalogItemSummary | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;

  const variables = Array.isArray(raw.variables) ? raw.variables : [];
  return removeUndefined({
    id,
    name: stringOrEmpty(raw.name),
    state: stringOrUndefined(raw.state),
    category: nestedString(raw.category, 'name'),
    subcategory: nestedString(raw.subcategory, 'name'),
    department: nestedString(raw.department, 'name'),
    site: nestedString(raw.site, 'name'),
    /** SWSD returns -1 when the count is unavailable; passthrough preserves the signal. */
    request_count: numberOrUndefined(raw.request_count),
    updated_at: stringOrUndefined(raw.updated_at),
    variable_count: variables.length,
  });
}

export function toCatalogItemDetail(raw: unknown): CatalogItemDetail | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;

  // `variables_unparsed` is a verbose internal field; the leading-underscore
  // name is matched by ESLint's varsIgnorePattern (^_) so no further suppression
  // is needed.
  const { variables_unparsed: _strip, variables, ...rest } = raw;
  return {
    ...rest,
    id,
    variables: Array.isArray(variables)
      ? variables
          .map(toCatalogItemVariable)
          .filter((v): v is CatalogItemVariable => v !== null)
      : [],
  };
}

function toCatalogItemVariable(raw: unknown): CatalogItemVariable | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;
  return removeUndefined({
    id,
    name: stringOrEmpty(raw.name),
    kind: stringOrUndefined(raw.kind),
    field_type: numberOrUndefined(raw.field_type),
    options: stringOrUndefined(raw.options),
    required: stringOrUndefined(raw.required),
    helptext: stringOrUndefined(raw.helptext),
  });
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

function nestedString(v: unknown, key: string): string | undefined {
  if (!isPlainObject(v)) return undefined;
  const inner = v[key];
  return typeof inner === 'string' ? inner : undefined;
}

function removeUndefined<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) {
    if (o[k] === undefined) delete o[k];
  }
  return o;
}

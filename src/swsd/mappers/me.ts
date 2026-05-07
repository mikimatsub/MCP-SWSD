import type { UserMeRecord } from '../types.js';

/**
 * Project SWSD's `/users/{id}.json` response (and optionally `/profile.json`)
 * into a stable UserMeRecord. The /profile.json response adds last_login
 * (and a few other fields the schema doesn't currently surface).
 *
 * Returns null on malformed input (non-object, missing/non-numeric id).
 *
 * Note: filters non-numeric entries out of group_ids defensively. SWSD has
 * been observed to occasionally include null entries in array-of-int fields.
 */
export function toUserMeRecord(
  raw: unknown,
  profile?: unknown,
): UserMeRecord | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;

  const groupIdsRaw = Array.isArray(raw.group_ids) ? raw.group_ids : [];
  const group_ids = groupIdsRaw
    .map((v) => numberOrNull(v))
    .filter((v): v is number => v !== null);

  const base: UserMeRecord = {
    id,
    email: stringOrUndefined(raw.email),
    name: stringOrUndefined(raw.name),
    title: stringOrUndefined(raw.title),
    role: nestedString(raw.role, 'name'),
    department: nestedString(raw.department, 'name'),
    site: nestedString(raw.site, 'name'),
    group_ids,
    disabled: typeof raw.disabled === 'boolean' ? raw.disabled : undefined,
    available_for_assignment:
      typeof raw.available_for_assignment === 'boolean'
        ? raw.available_for_assignment
        : undefined,
  };

  if (isPlainObject(profile)) {
    const lastLogin = stringOrUndefined(profile.last_login);
    if (lastLogin !== undefined) base.last_login = lastLogin;
  }

  return base;
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

function stringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function nestedString(parent: unknown, key: string): string | undefined {
  if (!isPlainObject(parent)) return undefined;
  const v = parent[key];
  return typeof v === 'string' ? v : undefined;
}

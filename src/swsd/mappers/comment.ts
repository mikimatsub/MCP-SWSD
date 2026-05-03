import type { CommentSummary } from '../types.js';

export function toCommentSummary(raw: unknown): CommentSummary | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;
  return {
    id,
    body: stringOrEmpty(raw.body),
    is_private: typeof raw.is_private === 'boolean' ? raw.is_private : false,
    author_email: nestedString(raw.user, 'email') ?? nestedString(raw.commenter, 'email'),
    author_name: nestedString(raw.user, 'name') ?? nestedString(raw.commenter, 'name'),
    created_at: stringOrUndefined(raw.created_at),
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
  return typeof v === 'string' ? v : undefined;
}

function nestedString(parent: unknown, key: string): string | undefined {
  if (!isPlainObject(parent)) return undefined;
  const v = parent[key];
  return typeof v === 'string' ? v : undefined;
}

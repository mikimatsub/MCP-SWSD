import type { SolutionSummary, SolutionDetail } from '../types.js';

const EXCERPT_MAX_CHARS = 240;

/**
 * Project a raw SWSD solution into a compact summary. Includes a
 * pre-truncated excerpt from `description_no_html` so agents can skim
 * results without pulling the full HTML body.
 */
export function toSolutionSummary(raw: unknown): SolutionSummary | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;

  return {
    id,
    number: numberOrUndefined(raw.number),
    name: stringOrEmpty(raw.name),
    state: stringOrUndefined(raw.state),
    category: nestedString(raw.category, 'name'),
    excerpt: excerpt(stringOrUndefined(raw.description_no_html)),
    requester_email: nestedString(raw.requester, 'email'),
    updated_at: stringOrUndefined(raw.updated_at),
    href: stringOrUndefined(raw.href),
  };
}

export function toSolutionDetail(raw: unknown): SolutionDetail | null {
  if (!isPlainObject(raw)) return null;
  const id = numberOrNull(raw.id);
  if (id === null) return null;
  return { ...raw, id };
}

export interface SolutionWriteFields {
  name?: string;
  description?: string;
  state?: string;
  category_name?: string;
  /**
   * Tenant-specific custom field values. Each row is `{name, value}`.
   * IMPORTANT: solutions REQUIRE name keying — the custom_field_id-only
   * variant returns 400 (verified live May 6, 2026). For incidents either
   * works; standardize on name for cross-entity portability.
   */
  custom_fields?: { name: string; value: string | number | boolean }[];
}

/**
 * Build the SWSD POST/PUT request body for solution create/update.
 * Mirrors the incident write-payload pattern: only includes fields the
 * caller explicitly provided, nests category as { name }.
 */
export function buildSolutionWritePayload(
  fields: SolutionWriteFields,
): { solution: Record<string, unknown> } {
  const solution: Record<string, unknown> = {};
  if (fields.name !== undefined) solution.name = fields.name;
  if (fields.description !== undefined) solution.description = fields.description;
  if (fields.state !== undefined) solution.state = fields.state;
  if (fields.category_name !== undefined) solution.category = { name: fields.category_name };
  if (fields.custom_fields !== undefined && fields.custom_fields.length > 0) {
    solution.custom_fields_values = {
      custom_fields_value: fields.custom_fields.map((cf) => ({
        name: cf.name,
        value: cf.value,
      })),
    };
  }
  return { solution };
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

function excerpt(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= EXCERPT_MAX_CHARS) return trimmed;
  return trimmed.slice(0, EXCERPT_MAX_CHARS).trimEnd() + '...';
}

import { describe, it, expect } from 'vitest';
import { toAuditSummary } from '../../../src/swsd/mappers/audit.js';

describe('toAuditSummary', () => {
  it('projects compact summary from a full SWSD audit response', () => {
    const raw = {
      id: 99887766,
      uuid: 'abc-123',
      action: 'Update',
      message: 'State changed from New to On Hold',
      note: '',
      created_at: '2026-05-06T12:34:56Z',
      user: 'Alice Agent',
      user_id: 11643235,
      source_type: 'Incident',
      source_id: 12345,
      department: { id: 1, name: 'IT' },
      site: { id: 2, name: 'NYC' },
    };
    const a = toAuditSummary(raw);
    expect(a).toEqual({
      id: 99887766,
      message: 'State changed from New to On Hold',
      action: 'Update',
      created_at: '2026-05-06T12:34:56Z',
      user: 'Alice Agent',
      user_id: 11643235,
      note: '',
      source_type: 'Incident',
      source_id: 12345,
    });
  });

  it('returns null for non-object inputs', () => {
    expect(toAuditSummary(null)).toBeNull();
    expect(toAuditSummary(undefined)).toBeNull();
    expect(toAuditSummary('not an object')).toBeNull();
    expect(toAuditSummary(42)).toBeNull();
    expect(toAuditSummary([1, 2, 3])).toBeNull();
  });

  it('returns null when id is missing or non-numeric', () => {
    expect(toAuditSummary({ message: 'no id' })).toBeNull();
    expect(toAuditSummary({ id: 'not-a-number', message: 'x' })).toBeNull();
  });

  it('coerces a stringified numeric id', () => {
    const a = toAuditSummary({ id: '42', message: 'x' });
    expect(a?.id).toBe(42);
  });

  it('does not leak verbose nested fields (department, site) — those belong on the parent record', () => {
    const a = toAuditSummary({
      id: 1,
      message: 'x',
      department: { id: 1, name: 'IT' },
      site: { id: 2, name: 'NYC' },
    });
    expect(a).not.toHaveProperty('department');
    expect(a).not.toHaveProperty('site');
  });

  it('handles missing optional fields gracefully', () => {
    const a = toAuditSummary({ id: 1, message: 'x' });
    expect(a?.action).toBeUndefined();
    expect(a?.user).toBeUndefined();
    expect(a?.user_id).toBeUndefined();
    expect(a?.created_at).toBeUndefined();
    expect(a?.note).toBeUndefined();
    expect(a?.source_type).toBeUndefined();
    expect(a?.source_id).toBeUndefined();
  });

  it('preserves empty-string note (distinct from missing)', () => {
    const a = toAuditSummary({ id: 1, message: 'x', note: '' });
    expect(a?.note).toBe('');
  });

  it('requires message but emits empty string if missing rather than null', () => {
    const a = toAuditSummary({ id: 1 });
    expect(a).not.toBeNull();
    expect(a?.message).toBe('');
  });
});

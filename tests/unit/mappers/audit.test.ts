import { describe, it, expect } from 'vitest';
import { toAuditSummary } from '../../../src/swsd/mappers/audit.js';

// Real SWSD /incidents/{id}/audits.json entries do NOT have a numeric `id`
// field — only a string `uuid`. This was caught by the e2e smoke test after
// the synthetic fixtures had a fake `id` that diverged from production shape.
describe('toAuditSummary', () => {
  it('projects compact summary from a real SWSD audit response', () => {
    // Shape captured from a live probe of api.samanage.com.
    const raw = {
      message: 'State changed from New to On Hold',
      action: 'external',
      hardware_href: '',
      created_at: '2026-05-06T17:12:03-04:00',
      source_type: 'Incident',
      source_id: 180823669,
      user_id: null,
      user: null,
      site: null,
      department: null,
      note: null,
      uuid: '925677ff-7d55-48ca-930e-ed5bdf3db3ba',
    };
    const a = toAuditSummary(raw);
    expect(a).toEqual({
      uuid: '925677ff-7d55-48ca-930e-ed5bdf3db3ba',
      message: 'State changed from New to On Hold',
      action: 'external',
      created_at: '2026-05-06T17:12:03-04:00',
      source_type: 'Incident',
      source_id: 180823669,
    });
  });

  it('projects compact summary from a fully-populated user-driven audit', () => {
    const raw = {
      message: 'Comment added',
      action: 'Update',
      created_at: '2026-05-06T12:34:56Z',
      user: 'Alice Agent',
      user_id: 11643235,
      note: 'Investigating now',
      source_type: 'Incident',
      source_id: 12345,
      department: { id: 1, name: 'IT' },
      site: { id: 2, name: 'NYC' },
      uuid: 'abc-123',
    };
    const a = toAuditSummary(raw);
    expect(a).toEqual({
      uuid: 'abc-123',
      message: 'Comment added',
      action: 'Update',
      created_at: '2026-05-06T12:34:56Z',
      user: 'Alice Agent',
      user_id: 11643235,
      note: 'Investigating now',
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

  it('returns null when uuid is missing or non-string', () => {
    expect(toAuditSummary({ message: 'no uuid' })).toBeNull();
    expect(toAuditSummary({ uuid: 12345, message: 'numeric uuid' })).toBeNull();
    expect(toAuditSummary({ uuid: '', message: 'empty uuid' })).toBeNull();
    expect(toAuditSummary({ uuid: null, message: 'null uuid' })).toBeNull();
  });

  it('does not leak verbose nested fields (department, site, hardware_href)', () => {
    const a = toAuditSummary({
      uuid: 'x-1',
      message: 'x',
      department: { id: 1, name: 'IT' },
      site: { id: 2, name: 'NYC' },
      hardware_href: '/hardwares/42.json',
    });
    expect(a).not.toHaveProperty('department');
    expect(a).not.toHaveProperty('site');
    expect(a).not.toHaveProperty('hardware_href');
  });

  it('handles missing optional fields gracefully', () => {
    const a = toAuditSummary({ uuid: 'x-1', message: 'x' });
    expect(a?.action).toBeUndefined();
    expect(a?.user).toBeUndefined();
    expect(a?.user_id).toBeUndefined();
    expect(a?.created_at).toBeUndefined();
    expect(a?.note).toBeUndefined();
    expect(a?.source_type).toBeUndefined();
    expect(a?.source_id).toBeUndefined();
  });

  it('preserves empty-string note (distinct from missing/null)', () => {
    const a = toAuditSummary({ uuid: 'x-1', message: 'x', note: '' });
    expect(a?.note).toBe('');
  });

  it('treats null note (real SWSD shape) as missing rather than empty string', () => {
    const a = toAuditSummary({ uuid: 'x-1', message: 'x', note: null });
    expect(a?.note).toBeUndefined();
  });

  it('emits empty-string message if missing rather than null', () => {
    const a = toAuditSummary({ uuid: 'x-1' });
    expect(a).not.toBeNull();
    expect(a?.message).toBe('');
  });
});

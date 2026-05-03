import { describe, it, expect } from 'vitest';
import {
  toIncidentSummary,
  toIncidentDetail,
  buildIncidentWritePayload,
} from '../../../src/swsd/mappers/incident.js';

describe('toIncidentSummary', () => {
  it('projects compact summary from a full SWSD incident response', () => {
    const raw = {
      id: 12345,
      number: 12345,
      name: 'Printer offline',
      state: 'Assigned',
      priority: 'High',
      assignee: { email: 'agent@example.com', name: 'Alice', id: 1 },
      requester: { email: 'user@example.com', name: 'Bob', id: 2 },
      category: { name: 'Hardware', id: 5 },
      updated_at: '2026-05-01T12:00:00Z',
      href_account_domain: 'https://support.example.com/incidents/12345-printer-offline',
      description: 'Long description that should not appear in compact summary',
      custom_fields_values: [{ name: 'Cost Center', value: 'CC-42' }],
    };
    const s = toIncidentSummary(raw);
    expect(s).toEqual({
      id: 12345,
      number: 12345,
      name: 'Printer offline',
      state: 'Assigned',
      priority: 'High',
      assignee_email: 'agent@example.com',
      requester_email: 'user@example.com',
      category: 'Hardware',
      updated_at: '2026-05-01T12:00:00Z',
      url: 'https://support.example.com/incidents/12345-printer-offline',
    });
  });

  it('omits url when href_account_domain is missing', () => {
    const s = toIncidentSummary({ id: 1, name: 'x' });
    expect(s?.url).toBeUndefined();
  });

  it('does not leak verbose fields from the raw incident', () => {
    const raw = {
      id: 1,
      name: 'x',
      description: 'big',
      custom_fields_values: [{ name: 'a', value: 'b' }],
    };
    const s = toIncidentSummary(raw);
    expect(s).not.toHaveProperty('description');
    expect(s).not.toHaveProperty('custom_fields_values');
  });

  it('returns null for non-object inputs', () => {
    expect(toIncidentSummary(null)).toBeNull();
    expect(toIncidentSummary(undefined)).toBeNull();
    expect(toIncidentSummary('not an object')).toBeNull();
    expect(toIncidentSummary(123)).toBeNull();
    expect(toIncidentSummary([1, 2, 3])).toBeNull();
  });

  it('returns null when id is missing or non-numeric', () => {
    expect(toIncidentSummary({ name: 'no id' })).toBeNull();
    expect(toIncidentSummary({ id: 'not-a-number', name: 'x' })).toBeNull();
  });

  it('coerces a stringified numeric id', () => {
    const s = toIncidentSummary({ id: '42', name: 'x' });
    expect(s?.id).toBe(42);
  });

  it('handles missing nested fields gracefully', () => {
    const s = toIncidentSummary({ id: 1, name: 'x' });
    expect(s?.assignee_email).toBeUndefined();
    expect(s?.requester_email).toBeUndefined();
    expect(s?.category).toBeUndefined();
  });

  it('handles malformed nested fields without crashing', () => {
    const s = toIncidentSummary({
      id: 1,
      name: 'x',
      assignee: 'oops a string',
      category: 99,
    });
    expect(s?.assignee_email).toBeUndefined();
    expect(s?.category).toBeUndefined();
  });
});

describe('toIncidentDetail', () => {
  it('passes through every field keyed by id', () => {
    const raw = { id: 1, name: 'x', extra_field: 'value', nested: { a: 1 } };
    expect(toIncidentDetail(raw)).toEqual(raw);
  });

  it('returns null for non-objects (including arrays)', () => {
    expect(toIncidentDetail(null)).toBeNull();
    expect(toIncidentDetail(undefined)).toBeNull();
    expect(toIncidentDetail([1, 2, 3])).toBeNull();
    expect(toIncidentDetail('hello')).toBeNull();
  });

  it('returns null when id is missing', () => {
    expect(toIncidentDetail({ name: 'no id' })).toBeNull();
  });

  it('coerces stringified numeric id', () => {
    const d = toIncidentDetail({ id: '7', name: 'x' });
    expect(d?.id).toBe(7);
  });
});

describe('buildIncidentWritePayload', () => {
  it('wraps fields under {incident: ...}', () => {
    const p = buildIncidentWritePayload({ name: 'Test', priority: 'High' });
    expect(p).toEqual({ incident: { name: 'Test', priority: 'High' } });
  });

  it('nests assignee/requester/category as objects', () => {
    const p = buildIncidentWritePayload({
      assignee_email: 'a@example.com',
      requester_email: 'r@example.com',
      category_name: 'Hardware',
      site_name: 'NYC',
      department_name: 'Eng',
    });
    expect(p).toEqual({
      incident: {
        assignee: { email: 'a@example.com' },
        requester: { email: 'r@example.com' },
        category: { name: 'Hardware' },
        site: { name: 'NYC' },
        department: { name: 'Eng' },
      },
    });
  });

  it('omits unset fields entirely', () => {
    const p = buildIncidentWritePayload({ name: 'just a name' });
    expect(p).toEqual({ incident: { name: 'just a name' } });
    expect(p.incident).not.toHaveProperty('description');
    expect(p.incident).not.toHaveProperty('priority');
  });

  it('preserves explicit empty string for description', () => {
    const p = buildIncidentWritePayload({ description: '' });
    expect(p.incident).toEqual({ description: '' });
  });

  it('returns empty incident object when no fields provided', () => {
    expect(buildIncidentWritePayload({})).toEqual({ incident: {} });
  });

  it('handles state-only update', () => {
    expect(buildIncidentWritePayload({ state: 'Resolved' })).toEqual({
      incident: { state: 'Resolved' },
    });
  });
});

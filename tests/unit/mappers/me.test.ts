import { describe, it, expect } from 'vitest';
import { toUserMeRecord } from '../../../src/swsd/mappers/me.js';

describe('toUserMeRecord', () => {
  it('projects from a full /users/{id}.json response', () => {
    const raw = {
      id: 11643235,
      email: 'agent@example.com',
      name: 'Alice Agent',
      title: 'Service Desk Technician',
      disabled: false,
      available_for_assignment: true,
      role: { id: 316753, name: 'Administrator', description: '...' },
      site: { id: 2, name: 'NYC' },
      department: { id: 3, name: 'IT' },
      group_ids: [12990074, 99],
    };
    expect(toUserMeRecord(raw)).toEqual({
      id: 11643235,
      email: 'agent@example.com',
      name: 'Alice Agent',
      title: 'Service Desk Technician',
      role: 'Administrator',
      department: 'IT',
      site: 'NYC',
      group_ids: [12990074, 99],
      disabled: false,
      available_for_assignment: true,
    });
  });

  it('augments from a /profile.json response (adds last_login)', () => {
    const usersResponse = { id: 1, email: 'a@b.com', name: 'A', group_ids: [] };
    const profileResponse = {
      id: 1,
      email: 'a@b.com',
      name: 'A',
      group_ids: [],
      last_login: '2026-05-06T22:27:54.000Z',
    };
    const merged = toUserMeRecord(usersResponse, profileResponse);
    expect(merged?.last_login).toBe('2026-05-06T22:27:54.000Z');
    expect(merged?.id).toBe(1);
  });

  it('returns null for non-object inputs', () => {
    expect(toUserMeRecord(null)).toBeNull();
    expect(toUserMeRecord(undefined)).toBeNull();
    expect(toUserMeRecord('hello')).toBeNull();
    expect(toUserMeRecord([1, 2])).toBeNull();
  });

  it('returns null when id is missing or non-numeric', () => {
    expect(toUserMeRecord({ email: 'no-id' })).toBeNull();
    expect(toUserMeRecord({ id: 'not-a-number', email: 'x' })).toBeNull();
  });

  it('emits empty group_ids array when missing', () => {
    const r = toUserMeRecord({ id: 1, email: 'x' });
    expect(r?.group_ids).toEqual([]);
  });

  it('filters non-numeric entries out of group_ids', () => {
    const r = toUserMeRecord({ id: 1, group_ids: [10, 'oops', 20, null, 30] });
    expect(r?.group_ids).toEqual([10, 20, 30]);
  });

  it('handles malformed nested fields gracefully', () => {
    const r = toUserMeRecord({
      id: 1,
      email: 'x@y.com',
      role: 'oops a string',
      site: 99,
      department: null,
    });
    expect(r?.role).toBeUndefined();
    expect(r?.site).toBeUndefined();
    expect(r?.department).toBeUndefined();
  });

  it('coerces stringified numeric id', () => {
    const r = toUserMeRecord({ id: '42', email: 'x' });
    expect(r?.id).toBe(42);
  });
});

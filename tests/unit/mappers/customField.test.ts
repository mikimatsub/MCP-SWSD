import { describe, it, expect } from 'vitest';
import { toCustomFieldSummary } from '../../../src/swsd/mappers/customField.js';

describe('toCustomFieldSummary', () => {
  it('projects a typical SWSD custom-field metadata object', () => {
    const raw = {
      id: 11049347,
      name: 'Cost Center',
      field_type: 1,
      field_type_name: 'Text',
      required: true,
      module: 'Incident',
      value: null,
      values_array: [],
      sorted: null,
      help_text: 'The cost center to bill this ticket against.',
      active: true,
      scope_id: 1,
      scope_string: 'Service_Catalog',
      account_id: 46057,
      indexable_state: false,
      searchable_state: true,
      els_in_sync: false,
      field_validations: null,
    };
    const f = toCustomFieldSummary(raw);
    expect(f).toEqual({
      id: 11049347,
      name: 'Cost Center',
      type: 'Text',
      required: true,
      active: true,
      scope: 'Service_Catalog',
      module: 'Incident',
      values: undefined,
      help_text: 'The cost center to bill this ticket against.',
      searchable: true,
    });
  });

  it('extracts dropdown values from values_array', () => {
    const raw = {
      id: 1,
      name: 'Region',
      field_type_name: 'Dropdown',
      required: false,
      active: true,
      values_array: ['US-East', 'US-West', 'EU', 'APAC'],
    };
    const f = toCustomFieldSummary(raw);
    expect(f?.values).toEqual(['US-East', 'US-West', 'EU', 'APAC']);
  });

  it('drops non-string entries from values_array', () => {
    const raw = {
      id: 1,
      name: 'Mixed',
      field_type_name: 'Dropdown',
      required: false,
      active: true,
      values_array: ['one', 2, null, 'three', { obj: true }],
    };
    const f = toCustomFieldSummary(raw);
    expect(f?.values).toEqual(['one', 'three']);
  });

  it('omits values when array is empty', () => {
    const f = toCustomFieldSummary({
      id: 1,
      name: 'Plain',
      field_type_name: 'Text',
      required: false,
      active: true,
      values_array: [],
    });
    expect(f?.values).toBeUndefined();
  });

  it('defaults required and active to false when missing or non-boolean', () => {
    const f = toCustomFieldSummary({ id: 1, name: 'x', field_type_name: 'Text' });
    expect(f?.required).toBe(false);
    expect(f?.active).toBe(false);
    expect(f?.searchable).toBe(false);
  });

  it('treats null/missing module as undefined', () => {
    const f = toCustomFieldSummary({ id: 1, name: 'x', field_type_name: 'Text', module: null });
    expect(f?.module).toBeUndefined();
  });

  it('falls back to "Unknown" when field_type_name is missing', () => {
    const f = toCustomFieldSummary({ id: 1, name: 'x' });
    expect(f?.type).toBe('Unknown');
  });

  it('returns null for non-objects and missing id', () => {
    expect(toCustomFieldSummary(null)).toBeNull();
    expect(toCustomFieldSummary([])).toBeNull();
    expect(toCustomFieldSummary({ name: 'no id' })).toBeNull();
  });

  it('coerces stringified id', () => {
    const f = toCustomFieldSummary({ id: '42', name: 'x', field_type_name: 'Text' });
    expect(f?.id).toBe(42);
  });

  it('does not leak account_id, indexable_state, els_in_sync, field_validations', () => {
    const raw = {
      id: 1,
      name: 'x',
      field_type_name: 'Text',
      required: false,
      active: true,
      account_id: 46057,
      indexable_state: false,
      els_in_sync: false,
      field_validations: { regex: '.*' },
    };
    const f = toCustomFieldSummary(raw);
    expect(f).not.toHaveProperty('account_id');
    expect(f).not.toHaveProperty('indexable_state');
    expect(f).not.toHaveProperty('els_in_sync');
    expect(f).not.toHaveProperty('field_validations');
  });
});

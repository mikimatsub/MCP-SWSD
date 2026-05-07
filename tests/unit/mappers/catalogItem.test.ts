import { describe, it, expect } from 'vitest';
import {
  toCatalogItemSummary,
  toCatalogItemDetail,
} from '../../../src/swsd/mappers/catalogItem.js';

// Fixture mirrors the real shape captured by .research/v2/swsd-probes/.
// Notable: `category`/`subcategory`/`department`/`site` are nested objects with `name`;
// `request_count` is a number; `variables` is an array; `state` is "Approved"/"Internal"/"Draft".
const REAL_ITEM = {
  id: 2757496,
  url_id: '2757496-new-employee-onboarding-process',
  name: 'New Employee Onboarding Process ',
  description: '<p>HTML body</p>',
  price: null,
  currency: 'USD',
  show_price: false,
  state: 'Approved',
  portal_homepage: true,
  created_at: '2026-02-13T10:59:37.000-05:00',
  updated_at: '2026-03-12T11:52:26.000-04:00',
  image_href: 'https://api.samanage.com/catalog_item_images/abc',
  due_days: '7-10 Business Days',
  show_due_days: true,
  category: { id: 1, name: 'Employee Management' },
  subcategory: { id: 2, name: 'Onboarding' },
  department: null,
  site: null,
  tags: [],
  request_count: 42,
  custom: null,
  variables: [
    {
      id: 10999918,
      uuid: 10999918,
      name: 'New Employee First Name',
      kind: 'free_text',
      field_type: 1,
      options: null,
      required: '1',
      sorted: null,
      helptext: null,
    },
    {
      id: 10999942,
      uuid: 10999942,
      name: 'New Employee Hardware Profile',
      kind: 'drop_down_menu',
      field_type: 2,
      options: 'None\nAdministrative\nCAD Designer',
      required: '1',
      sorted: true,
      helptext: '<p>...</p>',
    },
  ],
  variables_unparsed: 'unused-internal-field',
};

describe('toCatalogItemSummary', () => {
  it('projects compact summary from a real catalog-item response', () => {
    const s = toCatalogItemSummary(REAL_ITEM);
    expect(s).toEqual({
      id: 2757496,
      name: 'New Employee Onboarding Process ',
      state: 'Approved',
      category: 'Employee Management',
      subcategory: 'Onboarding',
      request_count: 42,
      updated_at: '2026-03-12T11:52:26.000-04:00',
      variable_count: 2,
      // department/site null → undefined (omitted)
    });
  });

  it('returns null for non-object inputs', () => {
    expect(toCatalogItemSummary(null)).toBeNull();
    expect(toCatalogItemSummary('not an object')).toBeNull();
    expect(toCatalogItemSummary([])).toBeNull();
  });

  it('returns null when id is missing', () => {
    expect(toCatalogItemSummary({ name: 'no id' })).toBeNull();
  });

  it('handles missing optional nested fields', () => {
    const s = toCatalogItemSummary({ id: 1, name: 'minimal' });
    expect(s).toEqual({ id: 1, name: 'minimal', variable_count: 0 });
    expect(s).not.toHaveProperty('category');
  });

  it('handles variables=null gracefully', () => {
    const s = toCatalogItemSummary({ id: 1, name: 'x', variables: null });
    expect(s?.variable_count).toBe(0);
  });
});

describe('toCatalogItemDetail', () => {
  it('returns the raw shape with id and a normalized variables array', () => {
    const d = toCatalogItemDetail(REAL_ITEM);
    expect(d?.id).toBe(2757496);
    expect(d?.name).toBe('New Employee Onboarding Process ');
    expect(d?.variables).toHaveLength(2);
    expect(d?.variables?.[0]).toEqual({
      id: 10999918,
      name: 'New Employee First Name',
      kind: 'free_text',
      field_type: 1,
      required: '1',
      // options/helptext null → omitted
    });
    expect(d?.variables?.[1]?.options).toBe('None\nAdministrative\nCAD Designer');
    expect(d?.variables?.[1]?.helptext).toBe('<p>...</p>');
    // Pass-through: detail keeps category/description/etc. on the top level for power users
    expect(d?.description).toBe('<p>HTML body</p>');
    expect(d?.category).toEqual({ id: 1, name: 'Employee Management' });
  });

  it('returns null when id is missing', () => {
    expect(toCatalogItemDetail({ name: 'no id' })).toBeNull();
  });

  it('strips variables_unparsed (verbose internal field, not useful to clients)', () => {
    const d = toCatalogItemDetail(REAL_ITEM);
    expect(d).not.toHaveProperty('variables_unparsed');
  });
});

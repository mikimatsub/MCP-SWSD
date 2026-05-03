import type { ProfileName } from './env.js';

const READ_BASE = [
  'swsd_get_server_info',
  'swsd_health_check',
  'swsd_list_incidents',
  'swsd_get_incident',
  'swsd_list_incident_comments',
  'swsd_list_categories',
  'swsd_list_users',
] as const;

export const PROFILE_TOOLS = {
  triage: [
    ...READ_BASE,
    'swsd_add_incident_comment',
  ],
  agent: [
    ...READ_BASE,
    'swsd_add_incident_comment',
    'swsd_create_incident',
    'swsd_update_incident',
    'swsd_assign_incident',
    'swsd_update_incident_state',
    'swsd_list_sites',
    'swsd_list_departments',
    'swsd_list_groups',
    'swsd_list_roles',
    // Solution reads — agents often check the KB while triaging
    'swsd_search_solutions',
    'swsd_get_solution',
    // Custom-field schema introspection (validate before writing)
    'swsd_describe_custom_fields',
  ],
  knowledge: [
    'swsd_get_server_info',
    'swsd_health_check',
    'swsd_list_incidents',
    'swsd_get_incident',
    'swsd_list_categories',
    'swsd_list_users',
    // Full solution CRUD for KB authors
    'swsd_search_solutions',
    'swsd_get_solution',
    'swsd_create_solution',
    'swsd_update_solution',
    'swsd_describe_custom_fields',
  ],
  full: [
    'swsd_get_server_info',
    'swsd_health_check',
    'swsd_list_incidents',
    'swsd_get_incident',
    'swsd_list_incident_comments',
    'swsd_add_incident_comment',
    'swsd_create_incident',
    'swsd_update_incident',
    'swsd_assign_incident',
    'swsd_update_incident_state',
    'swsd_list_categories',
    'swsd_list_sites',
    'swsd_list_departments',
    'swsd_list_users',
    'swsd_list_groups',
    'swsd_list_roles',
    'swsd_search_solutions',
    'swsd_get_solution',
    'swsd_create_solution',
    'swsd_update_solution',
    'swsd_describe_custom_fields',
  ],
} as const satisfies Record<ProfileName, readonly string[]>;

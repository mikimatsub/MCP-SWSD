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
  ],
  knowledge: [
    'swsd_get_server_info',
    'swsd_health_check',
    'swsd_list_incidents',
    'swsd_get_incident',
    'swsd_list_categories',
    'swsd_list_users',
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
  ],
} as const satisfies Record<ProfileName, readonly string[]>;

import type { ProfileName } from './env.js';

export const PROFILE_TOOLS = {
  triage: [
    'swsd_get_server_info',
    'swsd_health_check',
    'swsd_list_incidents',
    'swsd_get_incident',
  ],
  agent: [
    'swsd_get_server_info',
    'swsd_health_check',
    'swsd_list_incidents',
    'swsd_get_incident',
  ],
  knowledge: [
    'swsd_get_server_info',
    'swsd_health_check',
  ],
  full: [
    'swsd_get_server_info',
    'swsd_health_check',
    'swsd_list_incidents',
    'swsd_get_incident',
  ],
} as const satisfies Record<ProfileName, readonly string[]>;

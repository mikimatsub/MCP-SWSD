export interface IncidentSummary {
  id: number;
  number?: number;
  name: string;
  state?: string;
  priority?: string;
  assignee_email?: string;
  requester_email?: string;
  category?: string;
  updated_at?: string;
  /** SWSD UI URL for this incident (from `href_account_domain`). */
  url?: string;
}

export type IncidentDetail = Record<string, unknown> & {
  id: number;
  name?: string;
};

export interface CommentSummary {
  id: number;
  body: string;
  is_private: boolean;
  author_email?: string;
  author_name?: string;
  created_at?: string;
}

export interface CategorySummary {
  id: number;
  name: string;
  parent_id?: number;
  children?: { id: number; name: string }[];
  default_assignee_id?: number;
}

export interface UserSummary {
  id: number;
  name: string;
  email?: string;
  disabled: boolean;
  available_for_assignment?: boolean;
  role?: string;
  site?: string;
  department?: string;
  title?: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  description?: string;
  disabled: boolean;
  member_count?: number;
}

export interface SiteSummary {
  id: number;
  name: string;
  location?: string;
  description?: string;
  time_zone?: string;
}

export interface DepartmentSummary {
  id: number;
  name: string;
  description?: string;
}

export interface RoleSummary {
  id: number;
  name: string;
  description?: string;
}

export interface SolutionSummary {
  id: number;
  number?: number;
  name: string;
  state?: string;
  category?: string;
  excerpt?: string;
  requester_email?: string;
  updated_at?: string;
  /** Relative API path to the solution (e.g. `/solutions/1234.json`). */
  href?: string;
}

export type SolutionDetail = Record<string, unknown> & {
  id: number;
  name?: string;
};

export interface CustomFieldSummary {
  id: number;
  name: string;
  /** Human-readable field type (e.g. "Text", "Date", "Dropdown", "Multi-picklist"). */
  type: string;
  required: boolean;
  active: boolean;
  /** Scope name (e.g. "Global", "Service_Catalog", "Incident"). */
  scope?: string;
  /** Module the field is scoped to, when applicable. */
  module?: string;
  /** Allowed values for Dropdown / Multi-picklist field types. */
  values?: string[];
  help_text?: string;
  searchable: boolean;
}

export interface AuditSummary {
  /**
   * Stable identifier for the audit entry. SWSD assigns a UUID string per
   * audit row (no numeric id is exposed by /{object}/{id}/audits.json).
   */
  uuid: string;
  /** Human-readable change description, e.g. "State changed from New to On Hold". */
  message: string;
  /** Action taken — typically "Update", "Create", or "Delete". */
  action?: string;
  created_at?: string;
  /** The user who performed the action (display name; user_id is separate). */
  user?: string;
  user_id?: number;
  /** Free-text note attached to the audit, often empty. */
  note?: string;
  /** Optional: source-record reference fields (helpful for global /audits queries). */
  source_type?: string;
  source_id?: number;
}

export interface UserMeRecord {
  id: number;
  email?: string;
  name?: string;
  title?: string;
  /** Role name (e.g. "Administrator", "Requester"). */
  role?: string;
  /** Department name. */
  department?: string;
  /** Site name. */
  site?: string;
  /** Group IDs the user belongs to. Empty array if none. */
  group_ids: number[];
  /** Whether the user account is disabled. */
  disabled?: boolean;
  /** Whether the user is currently configured to receive incident assignments. */
  available_for_assignment?: boolean;
  /** ISO timestamp of the user's last login (only present from /profile.json). */
  last_login?: string;
}

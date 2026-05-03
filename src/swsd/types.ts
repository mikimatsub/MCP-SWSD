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

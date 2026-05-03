import { z } from 'zod';

export const ListIncidentsInput = z.object({
  page: z
    .number()
    .int()
    .min(1)
    .max(10_000)
    .default(1)
    .describe('Page number (1-indexed).'),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe('Results per page (1-100). SWSD caps at 100.'),
  states: z
    .array(z.string().min(1))
    .optional()
    .describe('Filter to incidents matching ANY of these states (e.g. ["New", "Assigned"]).'),
  priorities: z
    .array(z.string().min(1))
    .optional()
    .describe('Filter to incidents matching ANY of these priorities (e.g. ["High", "Medium"]).'),
  categories: z
    .array(z.string().min(1))
    .optional()
    .describe('Filter to incidents matching ANY of these category names.'),
  assignee_email: z
    .string()
    .email()
    .optional()
    .describe('Filter to incidents assigned to this email.'),
  requester_email: z
    .string()
    .email()
    .optional()
    .describe('Filter to incidents requested by this email.'),
  updated_from: z
    .string()
    .min(10)
    .optional()
    .describe('Filter to incidents updated on or after this ISO date or datetime (YYYY-MM-DD or RFC 3339).'),
});

export const GetIncidentInput = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe('SWSD incident ID (numeric).'),
});

export const CreateIncidentInput = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .describe('Short incident title (required).'),
  description: z
    .string()
    .optional()
    .describe('Long-form description of the issue. Plain text or HTML.'),
  priority: z
    .string()
    .optional()
    .describe('Priority name (e.g., "Low", "Medium", "High"). Tenant-specific values.'),
  requester_email: z
    .string()
    .email()
    .optional()
    .describe('Email of the user the ticket is for. Defaults to the token owner if omitted.'),
  assignee_email: z
    .string()
    .email()
    .optional()
    .describe('Email of the agent to assign on creation. Use swsd_assign_incident later instead if you want to defer.'),
  category_name: z
    .string()
    .optional()
    .describe('Category name (must match an existing SWSD category — see swsd_list_categories).'),
  site_name: z
    .string()
    .optional()
    .describe('Site name (see swsd_list_sites).'),
  department_name: z
    .string()
    .optional()
    .describe('Department name (see swsd_list_departments).'),
});

export const UpdateIncidentInput = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe('SWSD incident ID to update.'),
  name: z.string().min(1).max(200).optional().describe('New short title.'),
  description: z.string().optional().describe('New description (replaces existing).'),
  priority: z.string().optional().describe('New priority name.'),
  category_name: z.string().optional().describe('New category name.'),
  site_name: z.string().optional().describe('New site name.'),
  department_name: z.string().optional().describe('New department name.'),
});

export const LinkSolutionToIncidentInput = z.object({
  incident_id: z
    .number()
    .int()
    .positive()
    .describe('Incident to attach the solution to.'),
  solution_id: z
    .number()
    .int()
    .positive()
    .describe('Solution to attach. Use swsd_search_solutions to find one.'),
});

export const AssignIncidentInput = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe('SWSD incident ID to assign.'),
  assignee_email: z
    .string()
    .email()
    .describe('Email of the agent to assign. Must be an SWSD user with available_for_assignment=true.'),
});

export const UpdateIncidentStateInput = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe('SWSD incident ID to transition.'),
  state: z
    .string()
    .min(1)
    .describe('New state name. Must match a valid SWSD state for this tenant — common values: "New - Unassigned", "Assigned", "In Progress", "Awaiting Input", "Resolved", "Closed". Use swsd_get_incident to see the current state.'),
});

export type ListIncidentsInput = z.infer<typeof ListIncidentsInput>;
export type GetIncidentInput = z.infer<typeof GetIncidentInput>;
export type CreateIncidentInput = z.infer<typeof CreateIncidentInput>;
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentInput>;
export type AssignIncidentInput = z.infer<typeof AssignIncidentInput>;
export type UpdateIncidentStateInput = z.infer<typeof UpdateIncidentStateInput>;
export type LinkSolutionToIncidentInput = z.infer<typeof LinkSolutionToIncidentInput>;

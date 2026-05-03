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

export type ListIncidentsInput = z.infer<typeof ListIncidentsInput>;
export type GetIncidentInput = z.infer<typeof GetIncidentInput>;

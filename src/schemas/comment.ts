import { z } from 'zod';

export const ListIncidentCommentsInput = z.object({
  incident_id: z
    .number()
    .int()
    .positive()
    .describe('SWSD incident ID whose comments to list.'),
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
    .describe('Results per page (1-100).'),
});

export const AddIncidentCommentInput = z.object({
  incident_id: z
    .number()
    .int()
    .positive()
    .describe('SWSD incident ID to comment on.'),
  body: z
    .string()
    .min(1)
    .max(50_000)
    .describe('Comment text. Plain text or HTML.'),
  is_private: z
    .boolean()
    .default(false)
    .describe('If true, the comment is internal-only (not visible to the requester). Default false.'),
});

export const UpdateCommentInput = z.object({
  incident_id: z
    .number()
    .int()
    .positive()
    .describe('Incident the comment belongs to.'),
  comment_id: z
    .number()
    .int()
    .positive()
    .describe('SWSD comment ID to update.'),
  body: z
    .string()
    .min(1)
    .max(50_000)
    .describe('New comment text (replaces existing). Plain text or HTML.'),
});

export type ListIncidentCommentsInput = z.infer<typeof ListIncidentCommentsInput>;
export type AddIncidentCommentInput = z.infer<typeof AddIncidentCommentInput>;
export type UpdateCommentInput = z.infer<typeof UpdateCommentInput>;

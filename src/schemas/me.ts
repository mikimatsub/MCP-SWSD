import { z } from 'zod';

export const GetMeInput = z.object({});

export type GetMeInput = z.infer<typeof GetMeInput>;

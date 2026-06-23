import { z } from 'zod';

export const updateWorkspaceSlugSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug must be provided and must not exceed 16 characters')
    .max(16, 'Slug must be provided and must not exceed 16 characters')
    .regex(/^[a-zA-Z0-9-]+$/, 'Hyphenated alphanumeric characters only'),
});

export type UpdateWorkspaceSlugBody = z.infer<typeof updateWorkspaceSlugSchema>;

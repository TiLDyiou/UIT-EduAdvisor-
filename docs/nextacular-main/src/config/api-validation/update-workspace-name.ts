import { z } from 'zod';

export const updateWorkspaceNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Name must be provided and must not exceed 16 characters')
    .max(16, 'Name must be provided and must not exceed 16 characters'),
});

export type UpdateWorkspaceNameBody = z.infer<typeof updateWorkspaceNameSchema>;

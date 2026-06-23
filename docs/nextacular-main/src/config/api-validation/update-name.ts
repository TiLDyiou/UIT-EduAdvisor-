import { z } from 'zod';

export const updateNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Name must be provided and must not exceed 32 characters')
    .max(32, 'Name must be provided and must not exceed 32 characters'),
});

export type UpdateNameBody = z.infer<typeof updateNameSchema>;

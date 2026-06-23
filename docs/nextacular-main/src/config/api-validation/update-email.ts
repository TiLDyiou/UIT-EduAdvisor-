import { z } from 'zod';

export const updateEmailSchema = z.object({
  email: z.string().email('Email must be valid'),
});

export type UpdateEmailBody = z.infer<typeof updateEmailSchema>;

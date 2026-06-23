import type { NextApiResponse } from 'next';
import type { z, ZodTypeAny } from 'zod';

export type ValidationErrorPayload = {
  errors: Record<string, { msg: string }>;
};

export const parseBody = <S extends ZodTypeAny>(
  schema: S,
  body: unknown,
  res: NextApiResponse
): z.infer<S> | null => {
  const result = schema.safeParse(body);

  if (!result.success) {
    const errors: Record<string, { msg: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? issue.path.join('.') : 'body';
      if (!errors[key]) {
        errors[key] = { msg: issue.message };
      }
    }
    res.status(422).json({ errors });
    return null;
  }

  return result.data;
};

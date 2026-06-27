import type { NextApiRequest, NextApiResponse } from 'next';

import {
  updateEmailSchema,
  validateSession,
} from '@/config/api-validation/index';
import { parseBody } from '@/lib/server/validate';
import { updateEmail } from '@/prisma/services/user';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  if (method === 'PUT') {
    const session = await validateSession(req, res);
    const body = parseBody(updateEmailSchema, req.body, res);
    if (!body) return;
    await updateEmail(session.user.userId, body.email, session.user.email);
    res.status(200).json({ data: { email: body.email } });
  } else {
    res
      .status(405)
      .json({ errors: { error: { msg: `${method} method unsupported` } } });
  }
};

export default handler;

import type { NextApiRequest, NextApiResponse } from 'next';

import {
  updateNameSchema,
  validateSession,
} from '@/config/api-validation/index';
import { parseBody } from '@/lib/server/validate';
import { updateName } from '@/prisma/services/user';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  if (method === 'PUT') {
    const session = await validateSession(req, res);
    const body = parseBody(updateNameSchema, req.body, res);
    if (!body) return;
    await updateName(session.user.userId, body.name);
    res.status(200).json({ data: { name: body.name } });
  } else {
    res
      .status(405)
      .json({ errors: { error: { msg: `${method} method unsupported` } } });
  }
};

export default handler;

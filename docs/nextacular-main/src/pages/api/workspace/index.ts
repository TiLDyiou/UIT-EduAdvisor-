import type { NextApiRequest, NextApiResponse } from 'next';
import slugify from 'slugify';

import {
  createWorkspaceSchema,
  validateSession,
} from '@/config/api-validation/index';
import { parseBody } from '@/lib/server/validate';
import { createWorkspace } from '@/prisma/services/workspace';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  if (method === 'POST') {
    const session = await validateSession(req, res);
    const body = parseBody(createWorkspaceSchema, req.body, res);
    if (!body) return;
    const slug = slugify(body.name.toLowerCase());
    await createWorkspace(
      session.user.userId,
      session.user.email,
      body.name,
      slug
    );
    res.status(200).json({ data: { name: body.name, slug } });
  } else {
    res
      .status(405)
      .json({ errors: { error: { msg: `${method} method unsupported` } } });
  }
};

export default handler;

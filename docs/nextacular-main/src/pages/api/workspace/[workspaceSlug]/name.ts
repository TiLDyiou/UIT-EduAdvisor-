import type { NextApiRequest, NextApiResponse } from 'next';

import {
  updateWorkspaceNameSchema,
  validateSession,
} from '@/config/api-validation/index';
import { parseBody } from '@/lib/server/validate';
import { updateName } from '@/prisma/services/workspace';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  if (method === 'PUT') {
    const session = await validateSession(req, res);
    const body = parseBody(updateWorkspaceNameSchema, req.body, res);
    if (!body) return;
    const { workspaceSlug } = req.query as { workspaceSlug: string };
    updateName(
      session.user.userId,
      session.user.email,
      body.name,
      workspaceSlug
    )
      .then((name) => res.status(200).json({ data: { name } }))
      .catch((error: Error) =>
        res.status(404).json({ errors: { error: { msg: error.message } } })
      );
  } else {
    res
      .status(405)
      .json({ errors: { error: { msg: `${method} method unsupported` } } });
  }
};

export default handler;

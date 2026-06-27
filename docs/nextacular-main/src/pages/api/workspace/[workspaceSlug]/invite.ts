import type { NextApiRequest, NextApiResponse } from 'next';

import {
  validateSession,
  workspaceInviteSchema,
} from '@/config/api-validation/index';
import { parseBody } from '@/lib/server/validate';
import { inviteUsers } from '@/prisma/services/workspace';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  if (method === 'POST') {
    const session = await validateSession(req, res);
    const body = parseBody(workspaceInviteSchema, req.body, res);
    if (!body) return;
    const { workspaceSlug } = req.query as { workspaceSlug: string };
    inviteUsers(
      session.user.userId,
      session.user.email,
      body.members,
      workspaceSlug
    )
      .then((members) => res.status(200).json({ data: { members } }))
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

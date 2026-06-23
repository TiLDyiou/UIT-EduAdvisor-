import type { NextApiRequest, NextApiResponse } from 'next';

import { validateSession } from '@/config/api-validation';
import { requireMemberInOwnedWorkspace } from '@/lib/server/authorization';
import { remove } from '@/prisma/services/membership';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  if (method === 'DELETE') {
    const session = await validateSession(req, res);
    const { memberId } = req.body as { memberId?: string };
    const authorized = await requireMemberInOwnedWorkspace(
      req,
      res,
      session,
      memberId
    );

    if (!authorized) return;

    await remove(authorized.member.id);
    res.status(200).json({ data: { deletedAt: new Date() } });
  } else {
    res
      .status(405)
      .json({ errors: { error: { msg: `${method} method unsupported` } } });
  }
};

export default handler;

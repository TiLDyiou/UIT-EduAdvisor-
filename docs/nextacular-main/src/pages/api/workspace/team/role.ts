import { TeamRole } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

import { validateSession } from '@/config/api-validation';
import { requireMemberInOwnedWorkspace } from '@/lib/server/authorization';
import { toggleRole } from '@/prisma/services/membership';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  if (method === 'PUT') {
    const session = await validateSession(req, res);
    const { memberId } = req.body as { memberId?: string };
    const authorized = await requireMemberInOwnedWorkspace(
      req,
      res,
      session,
      memberId
    );

    if (!authorized) return;

    const { member } = authorized;
    const nextRole =
      member.teamRole === TeamRole.MEMBER ? TeamRole.OWNER : TeamRole.MEMBER;
    await toggleRole(member.id, nextRole);
    res.status(200).json({ data: { updatedAt: new Date() } });
  } else {
    res
      .status(405)
      .json({ errors: { error: { msg: `${method} method unsupported` } } });
  }
};

export default handler;

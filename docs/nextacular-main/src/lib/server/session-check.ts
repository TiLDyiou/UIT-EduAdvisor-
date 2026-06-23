import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, type Session } from 'next-auth';

import { authOptions } from '@/lib/server/auth';

type NextFn = (_result?: unknown) => void;

const validateMiddleware = () => {
  return async (req: NextApiRequest, res: NextApiResponse, next: NextFn) => {
    const session = (await getServerSession(
      req,
      res,
      authOptions
    )) as Session | null;

    if (!session) {
      res
        .status(401)
        .json({ errors: { session: { msg: 'Unauthorized access' } } });
      return;
    }

    return next(session);
  };
};

export default validateMiddleware;

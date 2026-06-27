import type { NextApiRequest, NextApiResponse } from 'next';

type NextFn = (_result?: unknown) => void;

type Middleware = (
  _req: NextApiRequest,
  _res: NextApiResponse,
  _next: NextFn
) => unknown | Promise<unknown>;

const initMiddleware = (middleware: Middleware) => {
  return (req: NextApiRequest, res: NextApiResponse): Promise<unknown> =>
    new Promise((resolve, reject) => {
      middleware(req, res, (result) =>
        result instanceof Error ? reject(result) : resolve(result)
      );
    });
};

export default initMiddleware;

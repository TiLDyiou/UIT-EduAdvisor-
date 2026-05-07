import { z } from "zod";

/**
 * Server-side env (only available in server components / route handlers).
 *
 * `API_INTERNAL_URL` is the URL the web container uses to reach the API
 * service container-to-container (e.g. http://api:8000), which is different
 * from `NEXT_PUBLIC_API_URL` that the browser uses.
 */
const serverEnv = z.object({
  API_INTERNAL_URL: z.string().url().default("http://api:8000"),
});

const clientEnv = z.object({
  // Same origin as the web app so httpOnly session cookies work with /api/v1 rewrites.
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3000"),
});

export const env = {
  ...serverEnv.parse({
    API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  }),
  ...clientEnv.parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  }),
};

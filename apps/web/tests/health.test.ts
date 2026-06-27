/**
 * Smoke test for the web liveness route.
 *
 * Vitest runs in node environment (see vitest.config.ts), so we can call
 * the route handler directly without spinning up a Next.js server.
 */
import { describe, expect, it } from "vitest";

import { GET } from "../app/api/health/route";

describe("GET /api/health", () => {
  it("responds with status ok", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});

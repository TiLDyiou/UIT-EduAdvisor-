import { NextResponse } from "next/server";

/**
 * Liveness probe for the web container. Mirrors the contract of the
 * FastAPI `/healthz`: 200 + `{ status: "ok" }` if the process is up.
 *
 * Intentionally does NOT call the API. A failing API should not mark the
 * web container as unhealthy because the web container can still serve
 * static pages.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

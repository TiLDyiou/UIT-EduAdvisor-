/**
 * Browser calls use NEXT_PUBLIC_API_URL (same-origin + rewrite to FastAPI).
 */
export function apiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, {
    ...init,
    credentials: "include",
    headers,
  });
}

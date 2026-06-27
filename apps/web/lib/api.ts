export function apiBaseUrl(): string {
  if (typeof window === "undefined") {
    // In SSR, Node fetch requires an absolute URL. Use internal docker URL.
    return (process.env.API_INTERNAL_URL || "http://api:8000").replace(/\/$/, "");
  }
  // In browser, use the public API URL directly to avoid Vercel Proxy being blocked by Cloudflare.
  return (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
}

function buildUrl(path: string): string {
  return `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = buildUrl(path);
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, {
    ...init,
    credentials: "include",
    headers,
  });
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const r = await apiFetch(path, init);
  const body = (await r.json().catch(() => null)) as unknown;
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      data: null,
      error: parseApiError(body),
    };
  }
  return { ok: true, status: r.status, data: body as T, error: null };
}

export async function apiFormData<T>(
  path: string,
  formData: FormData,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const r = await apiFetch(path, {
    method: "POST",
    ...init,
    body: formData,
  });
  const body = (await r.json().catch(() => null)) as unknown;
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      data: null,
      error: parseApiError(body),
    };
  }
  return { ok: true, status: r.status, data: body as T, error: null };
}

export function parseApiError(body: unknown): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first === "object") {
        const msg = (first as { msg?: unknown }).msg;
        if (typeof msg === "string") return msg;
      }
    }
    if (detail && typeof detail === "object") {
      const error = (detail as { error?: unknown }).error;
      if (typeof error === "string") return error;
    }
  }
  return "request_failed";
}

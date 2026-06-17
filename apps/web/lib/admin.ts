"use client";

import { apiJson } from "@/lib/api";

export type AdminMe = { id: string; email: string; csrf_token: string };

export async function fetchAdminMe(): Promise<{
  ok: boolean;
  me: AdminMe | null;
  unauthorized: boolean;
}> {
  const r = await apiJson<AdminMe>("/api/v1/admin/me");
  if (r.status === 401) {
    return { ok: false, me: null, unauthorized: true };
  }
  return { ok: r.ok, me: r.data, unauthorized: false };
}

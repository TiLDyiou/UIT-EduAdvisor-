"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fetchAdminMe } from "@/lib/admin";
import { apiJson } from "@/lib/api";

type AuditItem = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  created_at: string;
};
type AuditResp = { items: AuditItem[] };

export default function AdminAuditPage() {
  const router = useRouter();
  const [items, setItems] = useState<AuditItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetchAdminMe();
      if (cancelled) return;
      if (me.unauthorized) {
        router.replace("/admin/login");
        return;
      }
      const r = await apiJson<AuditResp>("/api/v1/admin/audit-logs?limit=100");
      if (!cancelled && r.ok && r.data) setItems(r.data.items);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Audit logs</h1>
        <Link href="/admin" className="text-sm text-cyan-400 hover:underline">
          Quay lại dashboard
        </Link>
      </div>
      <section className="space-y-2 rounded border border-neutral-800 p-4">
        {items.map((x) => (
          <div key={x.id} className="rounded border border-neutral-800 p-3">
            <p className="font-medium">{x.action}</p>
            <p className="text-xs text-neutral-400">
              {x.target_type}:{x.target_id} at {x.created_at}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}

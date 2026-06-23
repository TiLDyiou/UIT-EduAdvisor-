"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAdminGuard } from "@/lib/admin-auth";
import { apiJson } from "@/lib/api";

type Tooltip = {
  id: number;
  keyword: string;
  short_explanation: string;
  is_active: boolean;
};
type TooltipList = { items: Tooltip[] };

export default function AdminTooltipsPage() {
  const { me, loading } = useAdminGuard();
  const [items, setItems] = useState<Tooltip[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await apiJson<TooltipList>("/api/v1/admin/tooltips?limit=200");
    if (r.ok && r.data) setItems(r.data.items);
  }
  useEffect(() => {
    if (me) void refresh();
  }, [me]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!me) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      keyword: String(fd.get("keyword") || ""),
      short_explanation: String(fd.get("short_explanation") || ""),
      policy_url: String(fd.get("policy_url") || ""),
      is_active: true,
    };
    const r = await apiJson<Tooltip>("/api/v1/admin/tooltips", {
      method: "POST",
      headers: { "X-CSRF-Token": me.csrf_token },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      setError(r.error || "create_failed");
      return;
    }
    e.currentTarget.reset();
    await refresh();
  }

  if (loading) return <main className="mx-auto max-w-5xl px-6 py-10">Đang tải...</main>;
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <h1 className="text-xl font-semibold">Tooltips</h1>
      <form className="grid gap-2 rounded border border-neutral-800 p-4 sm:grid-cols-3" onSubmit={onCreate}>
        <input name="keyword" required placeholder="Keyword" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="short_explanation" required placeholder="Short explanation" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="policy_url" placeholder="Policy url (https://...)" className="rounded bg-neutral-900 px-3 py-2" />
        <button className="rounded bg-cyan-600 px-3 py-2 font-medium text-black sm:col-span-3">Create tooltip</button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <section className="space-y-2 rounded border border-neutral-800 p-4">
        {items.map((x) => (
          <div key={x.id} className="rounded border border-neutral-800 p-3">
            <p className="font-medium">{x.keyword}</p>
            <p className="text-xs text-neutral-400">{x.short_explanation}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

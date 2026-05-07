"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAdminGuard } from "@/lib/admin-auth";
import { apiJson } from "@/lib/api";

type Curriculum = {
  id: number;
  major_id: number;
  name: string;
  effective_year: number;
  total_credits: number;
};
type CurriculumList = { items: Curriculum[] };

export default function AdminCurriculaPage() {
  const { me, loading } = useAdminGuard();
  const [items, setItems] = useState<Curriculum[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await apiJson<CurriculumList>("/api/v1/admin/curricula?limit=200");
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
      major_id: Number(fd.get("major_id") || 0),
      name: String(fd.get("name") || ""),
      effective_year: Number(fd.get("effective_year") || 0),
      total_credits: Number(fd.get("total_credits") || 0),
    };
    const r = await apiJson<Curriculum>("/api/v1/admin/curricula", {
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
      <h1 className="text-xl font-semibold">Curricula</h1>
      <form className="grid gap-2 rounded border border-neutral-800 p-4 sm:grid-cols-4" onSubmit={onCreate}>
        <input name="major_id" required type="number" min={1} placeholder="Major ID" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="name" required placeholder="Name" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="effective_year" required type="number" placeholder="Year" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="total_credits" required type="number" placeholder="Total credits" className="rounded bg-neutral-900 px-3 py-2" />
        <button className="rounded bg-cyan-600 px-3 py-2 font-medium text-black sm:col-span-4">Create curriculum</button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <section className="space-y-2 rounded border border-neutral-800 p-4">
        {items.map((x) => (
          <div key={x.id} className="rounded border border-neutral-800 p-3">
            <p className="font-medium">
              {x.name} ({x.effective_year})
            </p>
            <p className="text-xs text-neutral-400">
              major_id={x.major_id} total_credits={x.total_credits}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}

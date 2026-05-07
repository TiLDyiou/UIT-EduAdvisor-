"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAdminGuard } from "@/lib/admin-auth";
import { apiJson } from "@/lib/api";

type Resource = {
  id: number;
  course_id: number;
  title: string;
  url: string;
  resource_type: string;
  term_code: string | null;
  is_visible: boolean;
};
type ResourceList = { items: Resource[] };

export default function AdminResourcesPage() {
  const { me, loading } = useAdminGuard();
  const [items, setItems] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await apiJson<ResourceList>("/api/v1/admin/resources?limit=200");
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
      course_id: Number(fd.get("course_id") || 0),
      title: String(fd.get("title") || ""),
      url: String(fd.get("url") || ""),
      resource_type: String(fd.get("resource_type") || ""),
      term_code: String(fd.get("term_code") || ""),
      description: "",
      is_visible: true,
    };
    const r = await apiJson<Resource>("/api/v1/admin/resources", {
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
      <h1 className="text-xl font-semibold">Resources</h1>
      <form className="grid gap-2 rounded border border-neutral-800 p-4 sm:grid-cols-5" onSubmit={onCreate}>
        <input name="course_id" required type="number" min={1} placeholder="Course ID" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="title" required placeholder="Title" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="url" required placeholder="https://..." className="rounded bg-neutral-900 px-3 py-2" />
        <input name="resource_type" required placeholder="Type" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="term_code" placeholder="Term code" className="rounded bg-neutral-900 px-3 py-2" />
        <button className="rounded bg-cyan-600 px-3 py-2 font-medium text-black sm:col-span-5">Create resource</button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <section className="space-y-2 rounded border border-neutral-800 p-4">
        {items.map((x) => (
          <div key={x.id} className="rounded border border-neutral-800 p-3">
            <p className="font-medium">{x.title}</p>
            <p className="text-xs text-neutral-400">
              course={x.course_id} type={x.resource_type} term={x.term_code ?? "-"} visible={String(x.is_visible)}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}

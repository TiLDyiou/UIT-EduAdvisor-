"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAdminGuard } from "@/lib/admin-auth";
import { apiJson } from "@/lib/api";

type Course = {
  id: number;
  code: string;
  name: string;
  credits: number;
  kind: string;
  difficulty: string | null;
};
type CourseList = { items: Course[] };

export default function AdminCoursesPage() {
  const { me, loading } = useAdminGuard();
  const [items, setItems] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await apiJson<CourseList>("/api/v1/admin/courses?limit=200");
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
      code: String(fd.get("code") || ""),
      name: String(fd.get("name") || ""),
      credits: Number(fd.get("credits") || 0),
      kind: String(fd.get("kind") || ""),
      difficulty: String(fd.get("difficulty") || ""),
    };
    const r = await apiJson<Course>("/api/v1/admin/courses", {
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
      <h1 className="text-xl font-semibold">Courses</h1>
      <form className="grid gap-2 rounded border border-neutral-800 p-4 sm:grid-cols-5" onSubmit={onCreate}>
        <input name="code" required placeholder="Code" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="name" required placeholder="Name" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="credits" required type="number" min={1} placeholder="Credits" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="kind" required placeholder="Kind(core/elective...)" className="rounded bg-neutral-900 px-3 py-2" />
        <input name="difficulty" placeholder="Difficulty" className="rounded bg-neutral-900 px-3 py-2" />
        <button className="rounded bg-cyan-600 px-3 py-2 font-medium text-black sm:col-span-5">Create course</button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <section className="space-y-2 rounded border border-neutral-800 p-4">
        {items.map((c) => (
          <div key={c.id} className="rounded border border-neutral-800 p-3">
            <p className="font-medium">
              {c.code} - {c.name}
            </p>
            <p className="text-xs text-neutral-400">
              credits={c.credits} kind={c.kind} difficulty={c.difficulty ?? "-"}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}

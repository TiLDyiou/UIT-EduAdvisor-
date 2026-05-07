"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fetchAdminMe, type AdminMe } from "@/lib/admin";
import { apiFormData, apiJson } from "@/lib/api";

type JobResponse = { id: string; status: string; current_stage: string | null };
type Policy = {
  id: number;
  title: string;
  version: string;
  tag: string;
  effective_year: number;
  is_deprecated: boolean;
  chunk_count: number;
};
type PolicyList = { items: Policy[] };

export default function AdminPoliciesPage() {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await fetchAdminMe();
      if (cancelled) return;
      if (m.unauthorized) {
        router.replace("/admin/login");
        return;
      }
      if (m.ok && m.me) setMe(m.me);
      const list = await apiJson<PolicyList>("/api/v1/admin/policies");
      if (!cancelled && list.ok && list.data) setPolicies(list.data.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onUpload(formData: FormData) {
    if (!me) return;
    setBusy(true);
    setError(null);
    const res = await apiFormData<JobResponse>("/api/v1/admin/policies/upload", formData, {
      method: "POST",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!res.ok) {
      setError(res.error || "Upload thất bại");
      setBusy(false);
      return;
    }
    setBusy(false);
    const list = await apiJson<PolicyList>("/api/v1/admin/policies");
    if (list.ok && list.data) setPolicies(list.data.items);
  }

  async function onDeprecate(id: number) {
    if (!me) return;
    await apiJson<void>(`/api/v1/admin/policies/${id}/deprecate`, {
      method: "POST",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    const list = await apiJson<PolicyList>("/api/v1/admin/policies");
    if (list.ok && list.data) setPolicies(list.data.items);
  }

  async function onRestore(id: number) {
    if (!me) return;
    await apiJson<void>(`/api/v1/admin/policies/${id}/restore`, {
      method: "POST",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    const list = await apiJson<PolicyList>("/api/v1/admin/policies");
    if (list.ok && list.data) setPolicies(list.data.items);
  }

  if (loading) return <main className="mx-auto max-w-4xl px-6 py-10">Đang tải...</main>;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Policy ingest</h1>
        <Link href="/admin" className="text-sm text-cyan-400 hover:underline">
          Quay lại dashboard
        </Link>
      </div>
      <form
        className="grid gap-3 rounded border border-neutral-800 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          await onUpload(fd);
        }}
      >
        <input name="title" required placeholder="Title" className="rounded bg-neutral-900 px-3 py-2" />
        <div className="grid grid-cols-3 gap-2">
          <input name="version" required placeholder="Version" className="rounded bg-neutral-900 px-3 py-2" />
          <input name="effective_year" required placeholder="Year" className="rounded bg-neutral-900 px-3 py-2" />
          <input name="tag" required placeholder="Tag" className="rounded bg-neutral-900 px-3 py-2" />
        </div>
        <input type="file" name="file" required accept=".pdf,.docx" className="text-sm" />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button disabled={busy} className="rounded bg-cyan-600 px-3 py-2 font-medium text-black disabled:opacity-50">
          {busy ? "Đang upload..." : "Upload policy"}
        </button>
      </form>

      <section className="rounded border border-neutral-800 p-4">
        <h2 className="mb-3 text-sm uppercase text-neutral-400">Policy versions</h2>
        <div className="space-y-2">
          {policies.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded border border-neutral-800 p-3">
              <div>
                <p className="font-medium">
                  {p.title} ({p.version}) - {p.effective_year}
                </p>
                <p className="text-xs text-neutral-400">
                  tag={p.tag} chunks={p.chunk_count} status={p.is_deprecated ? "deprecated" : "active"}
                </p>
              </div>
              <div className="flex gap-2">
                {!p.is_deprecated ? (
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => onDeprecate(p.id)}>
                    Deprecate
                  </button>
                ) : (
                  <button className="rounded border px-2 py-1 text-xs" onClick={() => onRestore(p.id)}>
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

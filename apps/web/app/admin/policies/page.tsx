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
  tag: string;
  is_deprecated: boolean;
  chunk_count: number;
};
type PolicyList = { items: Policy[] };

const TAG_OPTIONS = [
  { value: "academic", label: "Quy che dao tao" },
  { value: "student_handbook", label: "So tay sinh vien" },
  { value: "scholarship", label: "Hoc bong & Ho tro tai chinh" },
  { value: "graduation", label: "Tot nghiep & Van bang" },
  { value: "internship", label: "Thuc tap & Doanh nghiep" },
  { value: "dormitory", label: "Ky tuc xa & Doi song SV" },
  { value: "disciplinary", label: "Ky luat & Xu ly vi pham" },
  { value: "other", label: "Khac" },
] as const;

function tagLabel(value: string): string {
  return TAG_OPTIONS.find((t) => t.value === value)?.label ?? value;
}

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
      setError(res.error || "Upload that bai");
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

  async function onDelete(id: number, title: string) {
    if (!me) return;
    if (!window.confirm(`Ban co chac chan muon XOA VINH VIEN quy che "${title}"?\n\nThao tac nay khong the hoan tac!`)) return;
    setError(null);
    const r = await apiJson<void>(`/api/v1/admin/policies/${id}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError(r.error || "Xoa that bai");
      return;
    }
    const list = await apiJson<PolicyList>("/api/v1/admin/policies");
    if (list.ok && list.data) setPolicies(list.data.items);
  }

  if (loading) return <main className="mx-auto max-w-4xl px-6 py-10">Dang tai...</main>;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quy che & Chinh sach (Policy Ingest)</h1>
        <Link href="/admin" className="text-sm text-cyan-400 hover:underline">
          Quay lai dashboard
        </Link>
      </div>

      <div className="rounded border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
        <p className="font-medium text-cyan-400 mb-1">Huong dan su dung:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Chuc nang nay dung de tai len cac tai lieu quy che, so tay sinh vien (dinh dang PDF hoac Docx).</li>
          <li>He thong se tu dong doc, chia nho va phan tich noi dung (Ingest) de lam co so tri thuc cho AI tra loi cau hoi.</li>
          <li><strong>Phan loai (Tag)</strong> giup nhom cac tai lieu theo de muc. Chon dung phan loai de AI tra loi chinh xac hon.</li>
          <li>Qua trinh Ingest dien ra ngam (Background Job). Co the theo doi tien do o muc <strong>Tien trinh nen</strong>.</li>
        </ul>
      </div>

      <form
        className="grid gap-4 rounded border border-neutral-800 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          await onUpload(fd);
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">Tieu de tai lieu</label>
          <input name="title" required placeholder="VD: Quy che dao tao dai hoc" className="rounded bg-neutral-900 border border-neutral-700 px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">Phan loai (Tag)</label>
          <select name="tag" required className="rounded bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-200">
            <option value="">-- Chon phan loai --</option>
            {TAG_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">File tai lieu (PDF, Docx)</label>
          <input type="file" name="file" required accept=".pdf,.docx" className="text-sm mt-1" />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button disabled={busy} className="mt-2 rounded bg-cyan-600 px-3 py-2 font-medium text-black disabled:opacity-50 hover:bg-cyan-500 transition-colors">
          {busy ? "Dang upload va xu ly..." : "Tai len quy che"}
        </button>
      </form>

      <section className="rounded border border-neutral-800 p-4">
        <h2 className="mb-3 text-sm uppercase text-neutral-400">Cac tai lieu quy che hien co</h2>
        {policies.length === 0 ? <p className="text-sm text-neutral-500">Chua co du lieu.</p> : null}
        <div className="space-y-2">
          {policies.map((p) => (
            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded border border-neutral-800 p-3">
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  Phan loai: <span className="text-cyan-400">{tagLabel(p.tag)}</span> • So doan (chunks): {p.chunk_count} • Trang thai: {p.is_deprecated ? <span className="text-red-400">Da vo hieu (Deprecated)</span> : <span className="text-green-400">Dang hieu luc (Active)</span>}
                </p>
              </div>
              <div className="flex gap-2">
                {!p.is_deprecated ? (
                  <button className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors" onClick={() => onDeprecate(p.id)}>
                    Vo hieu hoa
                  </button>
                ) : (
                  <button className="rounded border border-green-500/50 px-3 py-1.5 text-xs text-green-400 hover:bg-green-500/10 transition-colors" onClick={() => onRestore(p.id)}>
                    Khoi phuc
                  </button>
                )}
                <button className="rounded border border-red-700 bg-red-950/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-600 hover:text-white transition-colors" onClick={() => onDelete(p.id, p.title)}>
                  Xoa vinh vien
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

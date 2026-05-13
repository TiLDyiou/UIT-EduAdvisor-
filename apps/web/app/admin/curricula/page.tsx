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
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chương trình đào tạo</h1>
        <a href="/admin" className="text-sm text-cyan-400 hover:underline">Quay lại dashboard</a>
      </div>
      
      <div className="rounded border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
        <p className="font-medium text-cyan-400 mb-1">Hướng dẫn sử dụng:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Chức năng này cho phép quản lý danh sách các <strong>Khung chương trình đào tạo</strong> của trường.</li>
          <li>Khi tạo mới, bạn cần điền chính xác <strong>ID Ngành (Major ID)</strong> tương ứng trong hệ thống, <strong>Tên chương trình</strong> (VD: CNTT 2023), <strong>Năm áp dụng</strong>, và <strong>Tổng số tín chỉ</strong> yêu cầu.</li>
          <li>Dữ liệu này được hệ thống sử dụng làm mốc so sánh với kết quả học tập của sinh viên trong quá trình tư vấn.</li>
        </ul>
      </div>

      <form className="grid gap-3 rounded border border-neutral-800 p-4 sm:grid-cols-4" onSubmit={onCreate}>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">ID Ngành (Major ID)</label>
          <input name="major_id" required type="number" min={1} placeholder="VD: 1" className="rounded bg-neutral-900 border border-neutral-700 px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">Tên chương trình</label>
          <input name="name" required placeholder="VD: Chương trình chuẩn CNTT" className="rounded bg-neutral-900 border border-neutral-700 px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">Năm áp dụng</label>
          <input name="effective_year" required type="number" placeholder="VD: 2023" className="rounded bg-neutral-900 border border-neutral-700 px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">Tổng tín chỉ</label>
          <input name="total_credits" required type="number" placeholder="VD: 120" className="rounded bg-neutral-900 border border-neutral-700 px-3 py-2" />
        </div>
        <button className="rounded bg-cyan-600 px-3 py-2 font-medium text-black sm:col-span-4 hover:bg-cyan-500 transition-colors">Tạo mới</button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <section className="space-y-2 rounded border border-neutral-800 p-4">
        <h2 className="mb-3 text-sm uppercase text-neutral-400">Danh sách hiện có</h2>
        {items.length === 0 ? <p className="text-sm text-neutral-500">Chưa có dữ liệu.</p> : null}
        {items.map((x) => (
          <div key={x.id} className="rounded border border-neutral-800 p-3">
            <p className="font-medium">
              {x.name} <span className="text-neutral-400">({x.effective_year})</span>
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              ID Ngành: {x.major_id} • Tổng tín chỉ: {x.total_credits}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}

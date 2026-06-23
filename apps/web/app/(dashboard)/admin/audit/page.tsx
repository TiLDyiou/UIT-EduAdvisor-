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
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nhật ký hệ thống (Audit Logs)</h1>
        <Link href="/admin" className="text-sm text-cyan-400 hover:underline">
          Quay lại dashboard
        </Link>
      </div>

      <div className="rounded border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
        <p className="font-medium text-cyan-400 mb-1">Hướng dẫn sử dụng:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Chức năng này lưu lại các hành động quan trọng đã được thực hiện trên hệ thống.</li>
          <li>Thông tin bao gồm: Loại hành động (Action), Đối tượng bị tác động (Target Type & ID) và Thời gian thực hiện.</li>
          <li>Sử dụng nhật ký này để truy xuất nguồn gốc sự cố, theo dõi ai đã xóa/sửa/tạo mới dữ liệu.</li>
        </ul>
      </div>

      <section className="space-y-2 rounded border border-neutral-800 p-4">
        <h2 className="mb-3 text-sm uppercase text-neutral-400">Lịch sử hoạt động gần đây</h2>
        {items.length === 0 ? <p className="text-sm text-neutral-500">Chưa có nhật ký nào.</p> : null}
        {items.map((x) => (
          <div key={x.id} className="rounded border border-neutral-800 p-3">
            <p className="font-medium text-cyan-400">{x.action}</p>
            <p className="text-xs text-neutral-400 mt-1">
              Đối tượng: <span className="text-neutral-300">{x.target_type}</span> (ID: {x.target_id}) • Thời gian: {new Date(x.created_at).toLocaleString('vi-VN')}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}

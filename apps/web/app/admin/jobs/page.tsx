"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fetchAdminMe } from "@/lib/admin";
import { apiJson } from "@/lib/api";

type Job = {
  id: string;
  kind: string;
  status: string;
  current_stage: string | null;
  progress_percent: number | null;
  error_message: string | null;
  created_at: string;
};

export default function AdminJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetchAdminMe();
      if (cancelled) return;
      if (me.unauthorized) {
        router.replace("/admin/login");
        return;
      }
      const r = await apiJson<Job[]>("/api/v1/admin/jobs");
      if (!cancelled && r.ok && r.data) setJobs(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const t = setInterval(async () => {
      const r = await apiJson<Job[]>("/api/v1/admin/jobs");
      if (r.ok && r.data) setJobs(r.data);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Theo dõi tiến trình (Jobs Monitor)</h1>
        <Link href="/admin" className="text-sm text-cyan-400 hover:underline">
          Quay lại dashboard
        </Link>
      </div>

      <div className="rounded border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
        <p className="font-medium text-cyan-400 mb-1">Hướng dẫn sử dụng:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Trang này hiển thị tất cả các tác vụ chạy ngầm (Background Jobs) của hệ thống, ví dụ: <strong>Phân tích quy chế (Ingest)</strong>, <strong>Import dữ liệu Excel</strong>.</li>
          <li>Danh sách sẽ tự động làm mới trạng thái mỗi 3 giây.</li>
          <li>Bạn có thể kiểm tra xem một tác vụ đã thành công hay bị lỗi. Nếu có lỗi, hệ thống sẽ hiển thị mã lỗi chi tiết để quản trị viên khắc phục.</li>
        </ul>
      </div>

      <section className="space-y-2 rounded border border-neutral-800 p-4">
        {jobs.length === 0 ? <p className="text-sm text-neutral-500">Chưa có tiến trình nào.</p> : null}
        {jobs.map((j) => (
          <div key={j.id} className="rounded border border-neutral-800 p-3">
            <div className="flex justify-between items-start mb-1">
              <p className="font-medium text-cyan-400">
                {j.kind}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded border font-medium ${j.status === "succeeded" ? "border-green-500/30 bg-green-500/10 text-green-400" : j.status === "failed" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"}`}>
                {j.status}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Giai đoạn: {j.current_stage ?? "-"} • Tiến độ: {j.progress_percent ?? 0}% • Bắt đầu lúc: {new Date(j.created_at).toLocaleString('vi-VN')}
            </p>
            {j.error_message ? <p className="text-xs text-red-400 mt-2 p-2 bg-red-500/10 rounded border border-red-500/20 font-mono">Lỗi: {j.error_message}</p> : null}
          </div>
        ))}
      </section>
    </main>
  );
}

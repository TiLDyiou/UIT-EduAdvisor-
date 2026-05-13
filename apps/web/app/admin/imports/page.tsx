"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fetchAdminMe, type AdminMe } from "@/lib/admin";
import { apiFormData, apiJson } from "@/lib/api";

type ImportUploadResp = { job_id: string; kind: string; status: string };
type JobRow = {
  id: string;
  kind: string;
  status: string;
  current_stage: string | null;
  result_summary: { preview?: { valid_rows: number; invalid_rows: number } } | null;
};

export default function AdminImportsPage() {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refreshJobs() {
    const r = await apiJson<JobRow[]>("/api/v1/admin/jobs");
    if (r.ok && r.data) setJobs(r.data.filter((x) => x.kind.includes("import")));
  }

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
      await refreshJobs();
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => {
      void refreshJobs();
    }, 3000);
    return () => clearInterval(t);
  }, []);

  async function upload(kind: "exam-schedules" | "course-offerings", formData: FormData) {
    if (!me) return;
    setError(null);
    const r = await apiFormData<ImportUploadResp>(`/api/v1/admin/imports/${kind}`, formData, {
      method: "POST",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError(r.error || "Upload lỗi");
      return;
    }
    await refreshJobs();
  }

  async function apply(jobId: string) {
    if (!me) return;
    await apiJson<{ status: string }>(`/api/v1/admin/imports/${jobId}/apply`, {
      method: "POST",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    await refreshJobs();
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nhập dữ liệu Excel (Imports)</h1>
        <Link href="/admin" className="text-sm text-cyan-400 hover:underline">
          Quay lại dashboard
        </Link>
      </div>

      <div className="rounded border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
        <p className="font-medium text-cyan-400 mb-1">Hướng dẫn sử dụng:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Bạn có thể nhập dữ liệu <strong>Lịch thi</strong> hoặc <strong>Danh sách mở lớp</strong> từ file Excel do trường cung cấp.</li>
          <li>Quá trình gồm 2 bước: <strong>(1) Upload & Preview:</strong> Hệ thống đọc file, kiểm tra lỗi và báo cáo số dòng hợp lệ. <strong>(2) Apply:</strong> Nếu kết quả Preview tốt (ít lỗi), bấm <strong>Apply</strong> để chính thức lưu dữ liệu vào cơ sở dữ liệu.</li>
          <li>Theo dõi tiến độ import ở danh sách bên dưới. Khi trạng thái là <span className="text-green-400">succeeded</span> và giai đoạn là <span className="text-cyan-400">preview_completed</span>, nút Apply sẽ sáng lên.</li>
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <form
          className="space-y-3 rounded border border-neutral-800 p-4 flex flex-col justify-between"
          onSubmit={async (e) => {
            e.preventDefault();
            await upload("exam-schedules", new FormData(e.currentTarget));
          }}
        >
          <div>
            <p className="font-medium text-cyan-400">Import lịch thi (Exam Schedules)</p>
            <p className="text-xs text-neutral-400 mb-2">Định dạng hỗ trợ: .xlsx</p>
            <input type="file" name="file" required accept=".xlsx" className="text-sm w-full border border-neutral-800 p-2 rounded bg-neutral-900" />
          </div>
          <button className="w-full rounded bg-cyan-600 px-3 py-2 font-medium text-black hover:bg-cyan-500 transition-colors">Tải lên file Lịch thi</button>
        </form>
        <form
          className="space-y-3 rounded border border-neutral-800 p-4 flex flex-col justify-between"
          onSubmit={async (e) => {
            e.preventDefault();
            await upload("course-offerings", new FormData(e.currentTarget));
          }}
        >
          <div>
            <p className="font-medium text-cyan-400">Import mở lớp (Course Offerings)</p>
            <p className="text-xs text-neutral-400 mb-2">Định dạng hỗ trợ: .xlsx</p>
            <input type="file" name="file" required accept=".xlsx" className="text-sm w-full border border-neutral-800 p-2 rounded bg-neutral-900" />
          </div>
          <button className="w-full rounded bg-cyan-600 px-3 py-2 font-medium text-black hover:bg-cyan-500 transition-colors">Tải lên file Mở lớp</button>
        </form>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <section className="rounded border border-neutral-800 p-4">
        <h2 className="mb-3 text-sm uppercase text-neutral-400">Lịch sử các lần Import</h2>
        {jobs.length === 0 ? <p className="text-sm text-neutral-500">Chưa có tiến trình nào.</p> : null}
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded border border-neutral-800 p-3">
              <div>
                <p className="font-medium">
                  Loại: <span className="text-cyan-400">{j.kind}</span> • Trạng thái: {j.status === "succeeded" ? <span className="text-green-400">Hoàn thành ({j.status})</span> : j.status === "failed" ? <span className="text-red-400">Lỗi ({j.status})</span> : <span className="text-yellow-400">{j.status}</span>}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Giai đoạn hiện tại (stage): {j.current_stage ?? "-"}
                </p>
                <p className="text-xs text-neutral-400">
                  Kết quả Preview: {j.result_summary?.preview
                    ? <span><span className="text-green-400 font-medium">{j.result_summary.preview.valid_rows} dòng hợp lệ</span> / <span className="text-red-400 font-medium">{j.result_summary.preview.invalid_rows} dòng lỗi</span></span>
                    : "-"}
                </p>
              </div>
              <button
                onClick={() => apply(j.id)}
                className="rounded bg-neutral-800 border border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-cyan-600 hover:text-black hover:border-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-neutral-800 disabled:hover:text-white disabled:hover:border-neutral-700"
                disabled={j.status !== "succeeded" || j.current_stage !== "preview_completed"}
              >
                Apply (Áp dụng)
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

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
        <h1 className="text-xl font-semibold">Excel imports</h1>
        <Link href="/admin" className="text-sm text-cyan-400 hover:underline">
          Quay lại dashboard
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <form
          className="space-y-3 rounded border border-neutral-800 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await upload("exam-schedules", new FormData(e.currentTarget));
          }}
        >
          <p className="text-sm font-medium">Import lịch thi</p>
          <input type="file" name="file" required accept=".xlsx" />
          <button className="rounded bg-cyan-600 px-3 py-2 text-black">Upload exam file</button>
        </form>
        <form
          className="space-y-3 rounded border border-neutral-800 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await upload("course-offerings", new FormData(e.currentTarget));
          }}
        >
          <p className="text-sm font-medium">Import mở lớp môn học</p>
          <input type="file" name="file" required accept=".xlsx" />
          <button className="rounded bg-cyan-600 px-3 py-2 text-black">Upload offering file</button>
        </form>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <section className="rounded border border-neutral-800 p-4">
        <h2 className="mb-3 text-sm uppercase text-neutral-400">Import jobs</h2>
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between rounded border border-neutral-800 p-3">
              <div>
                <p className="font-medium">
                  {j.kind} - {j.status}
                </p>
                <p className="text-xs text-neutral-400">
                  stage={j.current_stage ?? "-"} preview=
                  {j.result_summary?.preview
                    ? `${j.result_summary.preview.valid_rows}/${j.result_summary.preview.invalid_rows}`
                    : "-"}
                </p>
              </div>
              <button
                onClick={() => apply(j.id)}
                className="rounded border px-2 py-1 text-xs"
                disabled={j.status !== "succeeded" || j.current_stage !== "preview_completed"}
              >
                Apply
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

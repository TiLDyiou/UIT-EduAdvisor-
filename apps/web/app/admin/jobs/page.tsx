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
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin jobs</h1>
        <Link href="/admin" className="text-sm text-cyan-400 hover:underline">
          Quay lại dashboard
        </Link>
      </div>
      <section className="space-y-2 rounded border border-neutral-800 p-4">
        {jobs.map((j) => (
          <div key={j.id} className="rounded border border-neutral-800 p-3">
            <p className="font-medium">
              {j.kind} - {j.status}
            </p>
            <p className="text-xs text-neutral-400">
              stage={j.current_stage ?? "-"} progress={j.progress_percent ?? 0}% created={j.created_at}
            </p>
            {j.error_message ? <p className="text-xs text-red-400">error={j.error_message}</p> : null}
          </div>
        ))}
      </section>
    </main>
  );
}

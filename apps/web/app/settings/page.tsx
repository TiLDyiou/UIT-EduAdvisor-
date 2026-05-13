"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { aiMateDbClearAll } from "@/lib/ai-mate-db";
import { apiFetch } from "@/lib/api";

type Me = {
  student_id: string;
  student_code_masked: string;
  has_credential: boolean;
  csrf_token: string;
};

type SummaryRow = {
  id: string;
  session_started_at: string;
  courses_of_interest: string[];
  recent_questions: string[];
  created_at: string;
  expires_at: string;
};

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [summaries, setSummaries] = useState<SummaryRow[]>([]);

  const load = useCallback(async () => {
    setError(null);
    const r = await apiFetch("/api/v1/me");
    if (!r.ok) {
      setMe(null);
      setSummaries([]);
      setError("Chưa đăng nhập hoặc phiên đã hết hạn. Vào Onboarding để đăng nhập.");
      return;
    }
    const m = await r.json();
    setMe(m);
    const sr = await apiFetch("/api/v1/ai-mate/summaries");
    if (sr.ok) {
      setSummaries(await sr.json());
    } else {
      setSummaries([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDeleteSummary(id: string) {
    if (!me) return;
    const r = await apiFetch(`/api/v1/ai-mate/summaries/${id}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError("Xóa tóm tắt thất bại");
      return;
    }
    await load();
  }

  async function onClearAiHistory() {
    if (!me) return;
    if (
      !window.confirm(
        "Xóa toàn bộ tóm tắt/ghim AI trên server và xóa chat AI lưu cục bộ trên trình duyệt?",
      )
    ) {
      return;
    }
    const r = await apiFetch("/api/v1/ai-mate/history", {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError("Xóa lịch sử AI thất bại");
      return;
    }
    try {
      await aiMateDbClearAll();
    } catch {
      setError("Đã xóa server; xóa IndexedDB thất bại (thử xóa dữ liệu trang).");
      await load();
      return;
    }
    await load();
  }

  async function onDeleteCredential() {
    if (!me) return;
    if (!window.confirm("Xóa mật khẩu đã mã hóa trên máy chủ? Bạn sẽ không còn đồng bộ Moodle tự động.")) {
      return;
    }
    const r = await apiFetch("/api/v1/me/credential", {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError("Thao tác thất bại");
      return;
    }
    await load();
  }

  async function onDeleteAll() {
    if (!me) return;
    if (
      !window.confirm(
        "Xóa toàn bộ dữ liệu cá nhân trên hệ thống? Hành động này không thể hoàn tác.",
      )
    ) {
      return;
    }
    const r = await apiFetch("/api/v1/me/data", {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError("Thao tác thất bại");
      return;
    }
    window.location.href = "/onboarding";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">UIT EduAdvisor</p>
        <h1 className="text-2xl font-semibold tracking-tight">Cài đặt</h1>
        <nav className="flex flex-wrap gap-4 text-sm text-cyan-300">
          <Link href="/onboarding" className="hover:underline">
            Onboarding
          </Link>
          <Link href="/" className="hover:underline">
            Trang chủ
          </Link>
          <Link href="/ai-mate" className="hover:underline">
            AI Mate
          </Link>
        </nav>
      </header>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {me ? (
        <section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 text-sm">
          <p className="text-neutral-300">
            MSSV (đã ẩn): <span className="font-mono text-neutral-100">{me.student_code_masked}</span>
          </p>
          <p className="text-neutral-400">
            Trạng thái mật khẩu đã lưu:{" "}
            <span className="text-neutral-100">{me.has_credential ? "Có" : "Không"}</span>
          </p>

          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <h2 className="text-sm font-medium text-emerald-300">Dữ liệu AI Mate</h2>
            <p className="text-xs text-neutral-500">
              Tóm tắt phiên chỉ lưu chủ đề/môn quan tâm (không lưu chat nguyên văn). Chat thô lưu cục bộ tối đa
              30 ngày trên trình duyệt.
            </p>
            {summaries.length === 0 ? (
              <p className="text-neutral-500">Chưa có tóm tắt trên server.</p>
            ) : (
              <ul className="space-y-2">
                {summaries.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-1 rounded border border-neutral-800 p-2 text-xs text-neutral-300"
                  >
                    <span className="text-neutral-500">Hết hạn: {s.expires_at}</span>
                    <span>Môn quan tâm: {(s.courses_of_interest || []).join(", ") || "—"}</span>
                    <span>Chủ đề: {(s.recent_questions || []).join(", ") || "—"}</span>
                    <button
                      type="button"
                      onClick={() => void onDeleteSummary(s.id)}
                      className="self-start text-red-400 hover:underline"
                    >
                      Xóa tóm tắt này
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => void onClearAiHistory()}
              className="w-full rounded-md border border-amber-900/50 bg-amber-950/30 py-2 text-amber-100 hover:bg-amber-950/50"
            >
              Xóa toàn bộ lịch sử AI (server và local)
            </button>
          </div>

          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <h2 className="text-sm font-medium text-red-300">Vùng nguy hiểm</h2>
            <button
              type="button"
              onClick={() => void onDeleteCredential()}
              className="w-full rounded-md border border-red-900/60 bg-red-950/40 py-2 text-red-200 hover:bg-red-950/70"
            >
              Xóa mật khẩu đã mã hóa
            </button>
            <button
              type="button"
              onClick={() => void onDeleteAll()}
              className="w-full rounded-md border border-red-700 bg-red-900/30 py-2 text-red-100 hover:bg-red-900/50"
            >
              Xóa toàn bộ dữ liệu
            </button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-neutral-500">Đang tải…</p>
      )}
    </main>
  );
}

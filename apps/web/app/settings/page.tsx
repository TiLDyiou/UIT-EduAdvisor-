"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { apiFetch } from "@/lib/api";

type Me = {
  student_id: string;
  student_code_masked: string;
  has_credential: boolean;
  csrf_token: string;
};

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const r = await apiFetch("/api/v1/me");
    if (!r.ok) {
      setMe(null);
      setError("Chưa đăng nhập hoặc phiên đã hết hạn. Vào Onboarding để đăng nhập.");
      return;
    }
    setMe(await r.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        <nav className="flex gap-4 text-sm text-cyan-300">
          <Link href="/onboarding" className="hover:underline">
            Onboarding
          </Link>
          <Link href="/" className="hover:underline">
            Trang chủ
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

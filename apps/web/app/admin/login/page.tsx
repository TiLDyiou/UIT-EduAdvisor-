"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await apiFetch("/api/v1/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (r.status === 204) {
        router.replace("/admin");
        return;
      }
      const body = await r.json().catch(() => ({}));
      if (r.status === 429) {
        setError("Quá nhiều lần thử, vui lòng đợi một lúc rồi thử lại.");
      } else if (typeof body?.detail === "string") {
        setError(
          body.detail === "invalid_credentials"
            ? "Email hoặc mật khẩu không đúng."
            : body.detail,
        );
      } else {
        setError("Đăng nhập thất bại.");
      }
    } catch {
      setError("Không kết nối được tới server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-6 space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">UIT EduAdvisor</p>
        <h1 className="text-2xl font-semibold tracking-tight">Admin đăng nhập</h1>
      </header>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-6"
      >
        <label className="block space-y-1 text-sm">
          <span>Email</span>
          <input
            type="email"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none ring-cyan-500 focus:ring-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Mật khẩu</span>
          <input
            type="password"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none ring-cyan-500 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-cyan-600 py-2 text-sm font-medium text-black hover:bg-cyan-500 disabled:opacity-40"
        >
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Shield, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="w-full max-w-md px-6 py-12 admin-fade-in">
      <div
        className="rounded-2xl p-6 md:p-8 space-y-6 shadow-xl border backdrop-blur-md relative"
        style={{
          backgroundColor: "var(--admin-surface)",
          borderColor: "var(--admin-border)",
          boxShadow: "var(--admin-card-shadow)",
        }}
      >
        {/* Toggle light/dark button placed at the top-right of the card */}
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <header className="flex flex-col items-center text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl admin-active-accent shadow-md">
            <Shield className="h-6 w-6 text-white animate-pulse" />
          </div>
          <div className="space-y-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.25em]"
              style={{ color: "var(--admin-accent)" }}
            >
              UIT EduAdvisor
            </p>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--admin-text)" }}
            >
              Admin Portal
            </h1>
          </div>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-text-secondary)" }}>
            <span>Email</span>
            <input
              type="email"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all duration-200"
              style={{
                backgroundColor: "var(--admin-bg)",
                borderColor: "transparent",
                color: "var(--admin-text)",
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          
          <div className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-text-secondary)" }}>
            <span>Mật khẩu</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-lg border pl-3 pr-10 py-2.5 text-sm outline-none transition-all duration-200"
                style={{
                  backgroundColor: "var(--admin-bg)",
                  borderColor: "transparent",
                  color: "var(--admin-text)",
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="admin-btn-raw absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-neutral-250 transition-colors cursor-pointer"
                title={showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="h-4.5 w-4.5" style={{ color: "var(--admin-text-muted)" }} />
                ) : (
                  <Eye className="h-4.5 w-4.5" style={{ color: "var(--admin-text-muted)" }} />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p className="text-xs text-red-500 font-medium" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all cursor-pointer hover:shadow-lg disabled:opacity-40 disabled:pointer-events-none"
            style={{
              backgroundColor: "var(--admin-accent)",
            }}
          >
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { apiFetch } from "@/lib/api";

type CaptchaPayload = {
  captcha_state_id: string;
  question: string;
  image_base64: string | null;
};

type StartPayload = { job_id: string; student_id: string };

export default function OnboardingPage() {
  const [captcha, setCaptcha] = useState<CaptchaPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [tos, setTos] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  const loadCaptcha = useCallback(async () => {
    setError(null);
    const r = await apiFetch("/api/v1/onboarding/daa-captcha");
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(typeof body?.detail === "string" ? body.detail : "Không tải được captcha");
      return;
    }
    setCaptcha(await r.json());
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  const imageSrc = useMemo(() => {
    if (!captcha?.image_base64) return null;
    return `data:image/png;base64,${captcha.image_base64}`;
  }, [captcha]);

  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/v1/sync-jobs/${jobId}/events`);
    es.onmessage = (ev) => {
      setEvents((prev) => [...prev, ev.data]);
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [jobId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setEvents([]);
    try {
      if (!captcha) {
        setError("Captcha chưa sẵn sàng");
        return;
      }
      const r = await apiFetch("/api/v1/onboarding/start", {
        method: "POST",
        body: JSON.stringify({
          student_code: studentCode,
          password,
          captcha_state_id: captcha.captcha_state_id,
          captcha_answer: captchaAnswer,
          privacy_accepted: privacy,
          tos_accepted: tos,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(
          typeof body?.detail === "string"
            ? body.detail
            : "Đăng nhập thất bại — kiểm tra MSSV, mật khẩu hoặc captcha",
        );
        await loadCaptcha();
        return;
      }
      const data = (await r.json()) as StartPayload;
      setJobId(data.job_id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">UIT EduAdvisor</p>
        <h1 className="text-2xl font-semibold tracking-tight">Đồng bộ lần đầu</h1>
        <p className="text-sm text-neutral-400">
          Nhập MSSV và mật khẩu chứng thực (DAA/Moodle), giải captcha DAA, rồi bắt đầu đồng bộ.
        </p>
        <nav className="flex gap-4 text-sm text-cyan-300">
          <Link href="/settings" className="hover:underline">
            Cài đặt
          </Link>
          <Link href="/" className="hover:underline">
            Trang chủ
          </Link>
        </nav>
      </header>

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-neutral-800 bg-neutral-950/60 p-6">
        <label className="block space-y-1 text-sm">
          <span>Mã số sinh viên</span>
          <input
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none ring-cyan-500 focus:ring-2"
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value)}
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

        <div className="space-y-2 rounded-md border border-neutral-800 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-neutral-200">Mã xác nhận DAA</span>
            <button
              type="button"
              onClick={() => void loadCaptcha()}
              className="text-xs text-cyan-400 hover:underline"
            >
              Làm mới captcha
            </button>
          </div>
          {captcha ? (
            <>
              <p className="text-sm text-neutral-300">{captcha.question}</p>
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageSrc} alt="Captcha DAA" className="max-h-24 rounded border border-neutral-700" />
              ) : null}
              <input
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none ring-cyan-500 focus:ring-2"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                placeholder="Nhập đáp án captcha"
                required
              />
            </>
          ) : (
            <p className="text-sm text-neutral-500">Đang tải captcha…</p>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
            <span>Tôi đồng ý với Chính sách quyền riêng tư (privacy).</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={tos} onChange={(e) => setTos(e.target.checked)} />
            <span>Tôi đồng ý với Điều khoản dịch vụ (ToS).</span>
          </label>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={busy || !privacy || !tos}
          className="w-full rounded-md bg-cyan-600 py-2 text-sm font-medium text-black hover:bg-cyan-500 disabled:opacity-40"
        >
          {busy ? "Đang xử lý…" : "Bắt đầu đồng bộ"}
        </button>
      </form>

      {jobId ? (
        <section className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
          <h2 className="text-sm font-medium text-neutral-200">Tiến trình</h2>
          <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-neutral-400">
            {events.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

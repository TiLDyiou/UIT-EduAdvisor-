"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  LayoutDashboard,
  Calendar,
  Settings,
  Shield,
  GraduationCap,
  LogOut,
  Calculator,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

type CaptchaPayload = {
  captcha_state_id: string;
  question: string;
  image_base64: string | null;
};

type SyncEvent = {
  stage: string;
  progress_percent: number;
  message: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  daa_profile: "Tải hồ sơ DAA",
  daa_grades: "Đồng bộ điểm",
  daa_schedule: "Đồng bộ TKB",
  daa_exams: "Đồng bộ lịch thi",
  moodle_authenticating: "Đăng nhập Moodle",
  persisting: "Lưu dữ liệu",
  completed: "Hoàn tất",
  failed: "Lỗi",
};

function DaaResyncPanel({
  csrfToken,
  onSyncComplete,
  onCancel,
}: {
  csrfToken: string;
  onSyncComplete: () => void;
  onCancel: () => void;
}) {
  const [captcha, setCaptcha] = useState<CaptchaPayload | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);

  const loadCaptcha = useCallback(async () => {
    setError(null);
    const r = await apiFetch("/api/v1/resync/daa-captcha");
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(
        typeof body?.detail === "string"
          ? body.detail
          : "Không tải được captcha",
      );
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

  // SSE listener
  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/v1/sync-jobs/${jobId}/events`);
    es.onmessage = (ev) => {
      let payload: SyncEvent | null = null;
      try {
        payload = JSON.parse(ev.data) as SyncEvent;
      } catch {
        return;
      }
      setSyncEvents((prev) => [...prev, payload!]);
      if (payload.stage === "failed") {
        setError(payload.message || "Đồng bộ thất bại");
        return;
      }
      if (payload.stage === "completed") {
        es.close();
        setTimeout(() => onSyncComplete(), 1200);
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [jobId, onSyncComplete]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captcha) return;
    setError(null);
    setBusy(true);
    setSyncEvents([]);
    try {
      const r = await apiFetch("/api/v1/resync/daa", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          captcha_state_id: captcha.captcha_state_id,
          captcha_answer: captchaAnswer,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(
          typeof body?.detail === "string"
            ? body.detail
            : "Đồng bộ thất bại — kiểm tra captcha và thử lại",
        );
        await loadCaptcha();
        setCaptchaAnswer("");
        return;
      }
      const data = (await r.json()) as { job_id: string };
      setJobId(data.job_id);
    } finally {
      setBusy(false);
    }
  }

  const latest = syncEvents[syncEvents.length - 1];
  const pct = latest?.progress_percent ?? 0;
  const isFailed = latest?.stage === "failed" || (!!error && !!jobId);
  const isCompleted = latest?.stage === "completed";

  if (jobId) {
    const completedStages = new Set<string>();
    let activeStage: string | null = null;
    for (const ev of syncEvents) {
      if (ev.stage !== "completed" && ev.stage !== "failed") {
        completedStages.add(ev.stage);
      }
    }
    if (latest && latest.stage !== "completed" && latest.stage !== "failed") {
      completedStages.delete(latest.stage);
      activeStage = latest.stage;
    }
    const stages = [
      "daa_profile",
      "daa_grades",
      "daa_schedule",
      "daa_exams",
      "moodle_authenticating",
      "persisting",
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-300 font-medium font-sans">
            {isCompleted
              ? "Đồng bộ hoàn tất!"
              : isFailed
                ? "Đồng bộ thất bại"
                : latest?.message || "Đang đồng bộ..."}
          </span>
          <span className="font-mono text-cyan-400 font-bold">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-800 border border-neutral-750">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${isFailed ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : isCompleted ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="space-y-1.5 bg-black/20 p-3 rounded-xl border border-neutral-800/40">
          {stages.map((stage) => {
            const isDone = completedStages.has(stage) || isCompleted;
            const isActive = stage === activeStage && !isCompleted && !isFailed;
            return (
              <li
                key={stage}
                className={`flex items-center gap-2 text-xs transition-colors duration-300 ${isDone ? "text-emerald-400" : isActive ? "text-cyan-300" : "text-neutral-600"}`}
              >
                <span className="w-4 text-center font-bold font-sans">
                  {isDone ? "✓" : isActive ? "⟳" : "○"}
                </span>
                <span className="font-sans">
                  {STAGE_LABELS[stage] || stage}
                </span>
                {isActive && (
                  <span className="ml-auto h-2 w-2 animate-ping rounded-full bg-cyan-450" />
                )}
              </li>
            );
          })}
        </ul>
        {isFailed && error && (
          <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg font-sans">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-300 font-sans">
            Giải captcha DAA
          </span>
          <button
            type="button"
            onClick={() => void loadCaptcha()}
            className="text-xs text-cyan-400 hover:underline font-sans"
          >
            Làm mới
          </button>
        </div>
        {captcha ? (
          <div className="space-y-2 bg-black/40 p-3 rounded-xl border border-neutral-800/80">
            <p className="text-xs text-neutral-400 font-sans">
              {captcha.question}
            </p>
            {imageSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt="Captcha DAA"
                className="max-h-20 rounded border border-neutral-700 bg-neutral-900 mx-auto"
              />
            )}
            <input
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none ring-cyan-500 focus:ring-2 focus:border-transparent transition-all font-mono text-center tracking-widest"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              placeholder="Nhập đáp án captcha"
              required
            />
          </div>
        ) : (
          <p className="text-xs text-neutral-500 font-sans">
            Đang tải captcha…
          </p>
        )}
      </div>
      {error && !jobId && (
        <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg font-sans">
          {error}
        </p>
      )}
      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-neutral-700 text-neutral-350 py-2 text-sm font-semibold transition-all hover:bg-neutral-850 cursor-pointer font-sans"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={busy || !captcha}
          className="flex-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 py-2 text-sm font-semibold disabled:opacity-40 transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer font-sans"
        >
          {busy ? "Đang xử lý…" : "Đồng bộ"}
        </button>
      </div>
    </form>
  );
}

const NAV_ITEMS = [
  {
    title: "Trang chủ",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Dashboard",
    url: "/tracker",
    icon: GraduationCap,
  },
  {
    title: "GPA Tools",
    url: "/gpa-tools",
    icon: Calculator,
  },
  {
    title: "UIT Scheduler",
    url: "/scheduler",
    icon: Calendar,
  },
  {
    title: "Cài đặt",
    url: "/settings",
    icon: Settings,
  },
];

export function Sidebar({
  isCollapsed,
  onToggle,
}: {
  isCollapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{
    student_code_masked?: string;
    csrf_token?: string;
  } | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  useEffect(() => {
    apiFetch("/api/v1/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setMe(data))
      .catch(() => {});
  }, []);

  const isStudent = me && me.student_code_masked;

  const handleLogout = async () => {
    const isCurrentlyAdmin = pathname.startsWith("/admin");
    const endpoint = isCurrentlyAdmin
      ? "/api/v1/admin/auth/logout"
      : "/api/v1/auth/logout";

    try {
      await apiFetch(endpoint, {
        method: "POST",
        headers: me?.csrf_token ? { "X-CSRF-Token": me.csrf_token } : undefined,
      });
    } catch (e) {
      console.error("Logout failed", e);
    }

    router.replace(isCurrentlyAdmin ? "/admin/login" : "/onboarding");
  };

  return (
    <>
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex flex-col border-r border-[#3a494b]/20 bg-[#0e0e13] text-[#e4e1e9] transition-all duration-300 ${
          isCollapsed ? "w-[64px]" : "w-[260px]"
        }`}
      >
        <Link
          href="/"
          className={`flex h-16 shrink-0 items-center border-b border-[#3a494b]/20 overflow-hidden transition-all duration-300 hover:bg-white/5 ${isCollapsed ? "justify-center px-0" : "justify-start px-5 gap-3"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="UIT EduAdvisor"
            className={`object-contain shrink-0 transition-all duration-300 ${isCollapsed ? "h-6 w-auto" : "h-7 w-auto drop-shadow-md"}`}
          />
          {!isCollapsed && (
            <span className="text-[16px] font-extrabold tracking-tight whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-tokyo-cyan via-tokyo-blue to-tokyo-magenta drop-shadow-sm cursor-pointer select-none animate-gradient-x bg-[length:200%_auto] origin-left">
              UIT EduAdvisor
            </span>
          )}
        </Link>

        <nav
          className={`flex-1 overflow-y-auto py-6 ${isCollapsed ? "px-2" : "px-4"}`}
        >
          {!isCollapsed && (
            <div className="mb-4 text-[9px] font-mono tracking-wider text-[#849495] uppercase font-bold px-2">
              Tools
            </div>
          )}
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.url ||
                (item.url !== "/" && pathname.startsWith(item.url));
              const Icon = item.icon;

              return (
                <li key={item.url}>
                  <Link
                    href={item.url}
                    className={`flex items-center rounded-md text-sm font-medium transition-all duration-200 ${
                      isCollapsed
                        ? "justify-center h-10 w-10 mx-auto"
                        : "gap-3 px-3 py-2"
                    } ${
                      isActive
                        ? "bg-[#7aa2f7]/10 text-[#7dcfff] shadow-[inset_2px_0_0_#7aa2f7]"
                        : "text-[#b9cacb] hover:bg-[#1b1b20] hover:text-white"
                    }`}
                    title={isCollapsed ? item.title : undefined}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${isActive ? "text-[#7dcfff]" : "text-[#849495]"}`}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.title}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {!isStudent && (
            <>
              {!isCollapsed && (
                <div className="mt-8 mb-4 text-[9px] font-mono tracking-wider text-[#849495] uppercase font-bold px-2">
                  Quản trị
                </div>
              )}
              <ul className={`space-y-1 ${isCollapsed ? "mt-4" : ""}`}>
                <li>
                  <Link
                    href="/admin"
                    className={`flex items-center rounded-md text-sm font-medium transition-all duration-200 ${
                      isCollapsed
                        ? "justify-center h-10 w-10 mx-auto"
                        : "gap-3 px-3 py-2"
                    } ${
                      pathname.startsWith("/admin")
                        ? "bg-[#7000ff]/10 text-[#a366ff] shadow-[inset_2px_0_0_#7000ff]"
                        : "text-[#b9cacb] hover:bg-[#1b1b20] hover:text-white"
                    }`}
                    title={isCollapsed ? "Quản trị viên" : undefined}
                  >
                    <Shield
                      className={`h-4 w-4 shrink-0 ${pathname.startsWith("/admin") ? "text-[#7000ff]" : "text-[#849495]"}`}
                    />
                    {!isCollapsed && (
                      <span className="truncate">Quản trị viên</span>
                    )}
                  </Link>
                </li>
              </ul>
            </>
          )}
        </nav>

        <div
          className={`border-t border-[#3a494b]/20 ${isCollapsed ? "p-2" : "p-4"} space-y-1.5`}
        >
          {isStudent && (
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className={`flex w-full items-center rounded-md text-sm font-medium text-[#b9cacb] hover:bg-[#7aa2f7]/10 hover:text-[#7dcfff] transition-all duration-200 cursor-pointer ${
                isCollapsed ? "justify-center h-10" : "gap-3 px-3 py-2"
              }`}
              title={isCollapsed ? "Đồng bộ DAA" : undefined}
            >
              <RefreshCw className="h-4 w-4 shrink-0 text-[#849495] group-hover:text-[#7dcfff]" />
              {!isCollapsed && <span>Đồng bộ DAA</span>}
            </button>
          )}

          <button
            onClick={handleLogout}
            className={`flex w-full items-center rounded-md text-sm font-medium text-[#b9cacb] hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-200 cursor-pointer ${
              isCollapsed ? "justify-center h-10" : "gap-3 px-3 py-2"
            }`}
            title={isCollapsed ? "Đăng xuất" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0 text-[#849495] group-hover:text-rose-400" />
            {!isCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* DAA Sync Captcha Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#131318] border border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative anim-fade-in">
            <h3 className="text-base font-bold text-neutral-100 mb-2 flex items-center gap-2 font-sans">
              <RefreshCw className="size-4.5 text-cyan-400" />
              Đồng bộ dữ liệu DAA
            </h3>
            <p className="text-xs text-neutral-450 leading-relaxed mb-4 font-sans">
              Hệ thống sẽ tải lại lịch thi, điểm và thời khóa biểu mới nhất từ
              Cổng đào tạo DAA của bạn.
            </p>

            <DaaResyncPanel
              csrfToken={me?.csrf_token || ""}
              onSyncComplete={() => {
                setIsSyncModalOpen(false);
                window.location.reload();
              }}
              onCancel={() => setIsSyncModalOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

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

type BotAccount = {
  platform: string;
  platform_user_id: string;
  linked_at: string;
};

type ReminderPrefs = {
  exam_reminder: boolean;
  deadline_reminder: boolean;
};

type LinkTokenResult = {
  token: string;
  expires_at: string;
  deep_link: string;
};

const PLATFORMS = ["telegram", "discord", "messenger"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  telegram: "Telegram",
  discord: "Discord",
  messenger: "Messenger",
};

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [summaries, setSummaries] = useState<SummaryRow[]>([]);

  // Bot state
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const [reminderPrefs, setReminderPrefs] = useState<ReminderPrefs | null>(null);
  const [linkResult, setLinkResult] = useState<LinkTokenResult | null>(null);
  const [linkPlatform, setLinkPlatform] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const r = await apiFetch("/api/v1/me");
    if (!r.ok) {
      setMe(null);
      setSummaries([]);
      setBotAccounts([]);
      setReminderPrefs(null);
      setError("Chua dang nhap hoac phien da het han. Vao Onboarding de dang nhap.");
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
    // Load bot accounts
    const br = await apiFetch("/api/v1/bot/accounts");
    if (br.ok) {
      setBotAccounts(await br.json());
    }
    // Load reminder prefs
    const rr = await apiFetch("/api/v1/bot/reminders");
    if (rr.ok) {
      setReminderPrefs(await rr.json());
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
      setError("Xoa tom tat that bai");
      return;
    }
    await load();
  }

  async function onClearAiHistory() {
    if (!me) return;
    if (
      !window.confirm(
        "Xoa toan bo tom tat/ghim AI tren server va xoa chat AI luu cuc bo tren trinh duyet?",
      )
    ) {
      return;
    }
    const r = await apiFetch("/api/v1/ai-mate/history", {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError("Xoa lich su AI that bai");
      return;
    }
    try {
      await aiMateDbClearAll();
    } catch {
      setError("Da xoa server; xoa IndexedDB that bai (thu xoa du lieu trang).");
      await load();
      return;
    }
    await load();
  }

  async function onDeleteCredential() {
    if (!me) return;
    if (!window.confirm("Xoa mat khau da ma hoa tren may chu? Ban se khong con dong bo Moodle tu dong.")) {
      return;
    }
    const r = await apiFetch("/api/v1/me/credential", {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError("Thao tac that bai");
      return;
    }
    await load();
  }

  async function onDeleteAll() {
    if (!me) return;
    if (
      !window.confirm(
        "Xoa toan bo du lieu ca nhan tren he thong? Hanh dong nay khong the hoan tac.",
      )
    ) {
      return;
    }
    const r = await apiFetch("/api/v1/me/data", {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError("Thao tac that bai");
      return;
    }
    window.location.href = "/onboarding";
  }

  // --- Bot handlers ---

  async function onLinkBot(platform: string) {
    if (!me) return;
    setLinkResult(null);
    setLinkPlatform(platform);
    const r = await apiFetch("/api/v1/bot/link-token", {
      method: "POST",
      headers: { "X-CSRF-Token": me.csrf_token },
      body: JSON.stringify({ platform }),
    });
    if (!r.ok) {
      setError("Tao ma lien ket that bai");
      setLinkPlatform(null);
      return;
    }
    const data = await r.json();
    setLinkResult(data);
  }

  async function onUnlinkBot(platform: string) {
    if (!me) return;
    if (!window.confirm(`Huy lien ket ${PLATFORM_LABELS[platform] || platform}?`)) return;
    const r = await apiFetch(`/api/v1/bot/accounts/${platform}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError("Huy lien ket that bai");
      return;
    }
    await load();
  }

  async function onToggleReminder(field: "exam_reminder" | "deadline_reminder") {
    if (!me || !reminderPrefs) return;
    const updated = { ...reminderPrefs, [field]: !reminderPrefs[field] };
    const r = await apiFetch("/api/v1/bot/reminders", {
      method: "PUT",
      headers: { "X-CSRF-Token": me.csrf_token },
      body: JSON.stringify(updated),
    });
    if (!r.ok) {
      setError("Cap nhat nhac nho that bai");
      return;
    }
    setReminderPrefs(await r.json());
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">UIT EduAdvisor</p>
        <h1 className="text-2xl font-semibold tracking-tight">Cai dat</h1>
        <nav className="flex flex-wrap gap-4 text-sm text-cyan-300">
          <Link href="/onboarding" className="hover:underline">
            Onboarding
          </Link>
          <Link href="/" className="hover:underline">
            Trang chu
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
            MSSV (da an): <span className="font-mono text-neutral-100">{me.student_code_masked}</span>
          </p>
          <p className="text-neutral-400">
            Trang thai mat khau da luu:{" "}
            <span className="text-neutral-100">{me.has_credential ? "Co" : "Khong"}</span>
          </p>

          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <h2 className="text-sm font-medium text-emerald-300">Du lieu AI Mate</h2>
            <p className="text-xs text-neutral-500">
              Tom tat phien chi luu chu de/mon quan tam (khong luu chat nguyen van). Chat tho luu cuc bo toi da
              30 ngay tren trinh duyet.
            </p>
            {summaries.length === 0 ? (
              <p className="text-neutral-500">Chua co tom tat tren server.</p>
            ) : (
              <ul className="space-y-2">
                {summaries.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-1 rounded border border-neutral-800 p-2 text-xs text-neutral-300"
                  >
                    <span className="text-neutral-500">Het han: {s.expires_at}</span>
                    <span>Mon quan tam: {(s.courses_of_interest || []).join(", ") || "\u2014"}</span>
                    <span>Chu de: {(s.recent_questions || []).join(", ") || "\u2014"}</span>
                    <button
                      type="button"
                      onClick={() => void onDeleteSummary(s.id)}
                      className="self-start text-red-400 hover:underline"
                    >
                      Xoa tom tat nay
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
              Xoa toan bo lich su AI (server va local)
            </button>
          </div>

          {/* --- Bot section --- */}
          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <h2 className="text-sm font-medium text-blue-300">Ket noi Bot</h2>
            <p className="text-xs text-neutral-500">
              Lien ket tai khoan de nhan thong bao va tra cuu TKB, lich thi, deadline, GPA qua bot.
            </p>

            <div className="space-y-2">
              {PLATFORMS.map((p) => {
                const linked = botAccounts.find((a) => a.platform === p);
                return (
                  <div
                    key={p}
                    className="flex items-center justify-between rounded border border-neutral-800 p-2"
                  >
                    <div>
                      <span className="text-neutral-200">{PLATFORM_LABELS[p]}</span>
                      {linked ? (
                        <span className="ml-2 text-xs text-emerald-400">Da ket noi</span>
                      ) : (
                        <span className="ml-2 text-xs text-neutral-500">Chua ket noi</span>
                      )}
                    </div>
                    {linked ? (
                      <button
                        type="button"
                        onClick={() => void onUnlinkBot(p)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Huy lien ket
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onLinkBot(p)}
                        className="text-xs text-cyan-300 hover:underline"
                      >
                        Ket noi
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {linkResult && linkPlatform ? (
              <div className="rounded border border-blue-900/50 bg-blue-950/20 p-3 text-xs text-neutral-300">
                <p className="mb-1 text-blue-200">Ma lien ket {PLATFORM_LABELS[linkPlatform]}:</p>
                <p className="break-all font-mono text-neutral-100">{linkResult.deep_link}</p>
                <p className="mt-1 text-neutral-500">
                  Het han: {new Date(linkResult.expires_at).toLocaleTimeString()}
                </p>
                <button
                  type="button"
                  onClick={() => { setLinkResult(null); setLinkPlatform(null); }}
                  className="mt-2 text-neutral-400 hover:underline"
                >
                  Dong
                </button>
              </div>
            ) : null}

            {/* Reminder toggles */}
            {reminderPrefs ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-neutral-400">Nhac nho:</p>
                <label className="flex items-center gap-2 text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={reminderPrefs.exam_reminder}
                    onChange={() => void onToggleReminder("exam_reminder")}
                    className="accent-cyan-500"
                  />
                  Nhac lich thi (36h truoc)
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={reminderPrefs.deadline_reminder}
                    onChange={() => void onToggleReminder("deadline_reminder")}
                    className="accent-cyan-500"
                  />
                  Nhac deadline (18h truoc)
                </label>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <h2 className="text-sm font-medium text-red-300">Vung nguy hiem</h2>
            <button
              type="button"
              onClick={() => void onDeleteCredential()}
              className="w-full rounded-md border border-red-900/60 bg-red-950/40 py-2 text-red-200 hover:bg-red-950/70"
            >
              Xoa mat khau da ma hoa
            </button>
            <button
              type="button"
              onClick={() => void onDeleteAll()}
              className="w-full rounded-md border border-red-700 bg-red-900/30 py-2 text-red-100 hover:bg-red-900/50"
            >
              Xoa toan bo du lieu
            </button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-neutral-500">Dang tai...</p>
      )}
    </main>
  );
}

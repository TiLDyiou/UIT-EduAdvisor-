"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  aiMateDbAppend,
  aiMateDbClearOlderThanDays,
  aiMateDbDeleteThread,
  aiMateDbListThread,
  type AiMateLocalMessage,
} from "@/lib/ai-mate-db";
import { apiBaseUrl, apiFetch, parseApiError } from "@/lib/api";
import { parseSseJsonStream } from "@/lib/sse";

type Me = { student_id: string; csrf_token: string };

type Source = { document_id: number; document_title: string; tag: string; chunk_index: number };

const DISCLAIMER =
  "Thông tin tham khảo. Vui lòng kiểm tra lại với Phòng Đào tạo trước khi ra quyết định quan trọng.";

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function AiMatePage() {
  const threadId = useMemo(() => newId(), []);
  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<AiMateLocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSources, setLastSources] = useState<Source[]>([]);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const summaryAttempted = useRef(false);

  const loadMe = useCallback(async () => {
    const r = await apiFetch("/api/v1/me");
    if (!r.ok) {
      setMe(null);
      return;
    }
    setMe(await r.json());
  }, []);

  useEffect(() => {
    void aiMateDbClearOlderThanDays(30).catch(() => {});
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    void aiMateDbListThread(threadId).then(setMessages).catch(() => setMessages([]));
  }, [threadId]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;
    if (!me) {
      setError("Cần đăng nhập (Onboarding) để dùng AI Mate.");
      return;
    }
    setError(null);
    setBusy(true);
    setStreaming("");
    setInput("");
    setLastSources([]);
    setShowDisclaimer(false);

    const userMsg: AiMateLocalMessage = {
      id: newId(),
      thread_id: threadId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    await aiMateDbAppend(userMsg);

    const url = `${apiBaseUrl()}/api/v1/ai-mate/chat/stream`;
    let assistantText = "";
    let sources: Source[] = [];
    let disclaimer = false;

    try {
      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, client_thread_id: threadId }),
      });
      if (r.status === 401) {
        setError("Phiên hết hạn. Vào Onboarding để đăng nhập lại.");
        setBusy(false);
        return;
      }
      if (r.status === 429) {
        const body = await r.json().catch(() => null);
        setError(parseApiError(body) || "Đã vượt giới hạn tin nhắn mỗi giờ.");
        setBusy(false);
        return;
      }
      if (!r.ok || !r.body) {
        const body = await r.json().catch(() => null);
        setError(parseApiError(body));
        setBusy(false);
        return;
      }

      for await (const ev of parseSseJsonStream(r.body)) {
        if ("raw" in ev && ev.raw) continue;
        if (ev.event === "meta" && ev.data && typeof ev.data === "object") {
          const d = ev.data as { sources?: Source[] };
          sources = Array.isArray(d.sources) ? d.sources : [];
          setLastSources(sources);
        }
        if (ev.event === "delta" && ev.data && typeof ev.data === "object") {
          const t = (ev.data as { text?: string }).text;
          if (typeof t === "string") {
            assistantText += t;
            setStreaming(assistantText);
          }
        }
        if (ev.event === "done" && ev.data && typeof ev.data === "object") {
          disclaimer = Boolean((ev.data as { policy_disclaimer_required?: boolean }).policy_disclaimer_required);
          setShowDisclaimer(disclaimer || sources.length > 0);
        }
        if (ev.event === "error" && ev.data && typeof ev.data === "object") {
          const msg = (ev.data as { message?: string }).message;
          setError(typeof msg === "string" ? msg : "stream_error");
        }
      }

      const asstMsg: AiMateLocalMessage = {
        id: newId(),
        thread_id: threadId,
        role: "assistant",
        content: assistantText,
        created_at: new Date().toISOString(),
        sources,
        disclaimer_required: disclaimer,
      };
      setMessages((m) => [...m, asstMsg]);
      await aiMateDbAppend(asstMsg);
      setStreaming("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    } finally {
      setBusy(false);
    }
  }

  async function pinAssistant(content: string) {
    if (!me) return;
    const r = await apiFetch("/api/v1/ai-mate/pins", {
      method: "POST",
      headers: { "X-CSRF-Token": me.csrf_token },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
    });
    if (!r.ok) {
      setError("Ghim thất bại");
      return;
    }
    alert("Đã ghim lên server (nội dung ghim được lưu trên máy chủ theo PRD).");
  }

  async function endSessionSummary() {
    if (!me || summaryAttempted.current) return;
    summaryAttempted.current = true;
    const sessionStarted =
      messages[0]?.created_at ?? new Date(Date.now() - 3600000).toISOString();
    const transcript = messages.map((m) => ({
      role: m.role,
      content: m.content.slice(0, 8000),
    }));
    try {
      const r = await apiFetch("/api/v1/ai-mate/summaries", {
        method: "POST",
        headers: { "X-CSRF-Token": me.csrf_token },
        body: JSON.stringify({ session_started_at: sessionStarted, messages: transcript }),
      });
      if (!r.ok) {
        summaryAttempted.current = false;
        setError("Không tạo được tóm tắt trên server.");
        return;
      }
      alert("Đã gửi tóm tắt phiên lên server (chỉ lưu chủ đề/môn quan tâm, không lưu chat nguyên văn).");
    } catch {
      summaryAttempted.current = false;
      setError("Không tạo được tóm tắt.");
    }
  }

  async function clearLocal() {
    await aiMateDbDeleteThread(threadId);
    setMessages([]);
    setStreaming("");
    setLastSources([]);
    setShowDisclaimer(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-8">
      <header className="space-y-2 border-b border-neutral-800 pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">UIT EduAdvisor</p>
        <h1 className="text-2xl font-semibold">AI Mate</h1>
        <p className="text-sm text-neutral-400">
          Ngữ cảnh học vụ (điểm, môn học, lịch thi nếu có) có thể được gửi tới dịch vụ AI để trả lời. Tin nhắn
          chat chỉ lưu trên trình duyệt của bạn (tối đa 30 ngày), trừ khi bạn ghim hoặc tạo tóm tắt theo cấu
          trúc trên server.
        </p>
        <nav className="flex flex-wrap gap-3 text-sm text-cyan-300">
          <Link href="/" className="hover:underline">
            Trang chủ
          </Link>
          <Link href="/settings" className="hover:underline">
            Cài đặt
          </Link>
          <Link href="/onboarding" className="hover:underline">
            Onboarding
          </Link>
        </nav>
      </header>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <section className="flex min-h-[320px] flex-1 flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
        <div className="flex-1 space-y-3 overflow-y-auto text-sm">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-8 rounded-md bg-cyan-950/40 p-2 text-neutral-100"
                  : "mr-8 rounded-md border border-neutral-800 bg-neutral-900/60 p-2 text-neutral-200"
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-cyan-400 hover:underline"
                  onClick={() => void pinAssistant(m.content)}
                >
                  Ghim lên server
                </button>
              ) : null}
              {m.sources && m.sources.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-xs text-neutral-500">
                  {m.sources.map((s) => (
                    <li key={`${s.document_id}-${s.chunk_index}`}>
                      {s.document_title} ({s.tag}) — đoạn {s.chunk_index}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          {streaming ? (
            <div className="mr-8 rounded-md border border-neutral-700 bg-neutral-900/40 p-2 text-neutral-200">
              <p className="whitespace-pre-wrap">{streaming}</p>
            </div>
          ) : null}
        </div>

        {(showDisclaimer || lastSources.length > 0) && !streaming ? (
          <p className="text-xs text-amber-200/90">{DISCLAIMER}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-neutral-800 pt-3">
          <textarea
            className="min-h-[72px] flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
            placeholder="Hỏi về GPA, môn học, hoặc quy chế…"
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="flex w-full flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void sendMessage()}
              className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-40"
            >
              Gửi
            </button>
            <button
              type="button"
              disabled={busy || messages.length === 0}
              onClick={() => void endSessionSummary()}
              className="rounded-md border border-neutral-600 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
            >
              Kết thúc phiên (tóm tắt server)
            </button>
            <button
              type="button"
              onClick={() => void clearLocal()}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900"
            >
              Xóa chat cục bộ (thread này)
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

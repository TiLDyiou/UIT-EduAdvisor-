"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  aiMateDbAppend,
  aiMateDbClearOlderThanDays,
  aiMateDbListThread,
  aiMateDbDeleteThread,
  type AiMateLocalMessage,
} from "@/lib/ai-mate-db";
import { apiBaseUrl, apiFetch, parseApiError } from "@/lib/api";
import { parseSseJsonStream } from "@/lib/sse";
import { Send, X, Pin, Loader2, AlertTriangle, FileText, Trash2 } from "lucide-react";

type Me = { student_id: string; csrf_token: string };
type Source = {
  document_id: number;
  document_title: string;
  tag: string;
  chunk_index: number;
  content?: string;
};

const DISCLAIMER =
  "Thông tin tham khảo. Vui lòng kiểm tra lại với Phòng Đào tạo trước khi ra quyết định quan trọng.";

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function FormattedText({ text, role }: { text: string; role?: "user" | "assistant" }) {
  const lines = text.split("\n");
  const isUser = role === "user";
  
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />; // Empty lines = spacer
        
        const isBullet = !isUser && line.trimStart().startsWith("- ");
        const content = isBullet ? line.trimStart().slice(2) : line;
        
        // Parse inline bold/italic
        const parts = content.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        
        const lineContent = parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
            return <strong key={j} className={`font-semibold ${isUser ? "text-white" : "text-white/90"}`}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
            return <em key={j} className={`italic ${isUser ? "text-white/80" : "text-neutral-400"}`}>{part.slice(1, -1)}</em>;
          }
          return <span key={j}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={i} className="pl-3 relative">
              <span className="absolute left-0 top-[0.3em] text-[8px] text-neutral-500">●</span>
              {lineContent}
            </div>
          );
        }
        
        return <div key={i}>{lineContent}</div>;
      })}
    </div>
  );
}

export function UITMateWidget() {
  const [me, setMe] = useState<Me | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AiMateLocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOverloaded, setIsOverloaded] = useState<{ seconds: number } | null>(null);
  const [lastSources, setLastSources] = useState<Source[]>([]);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [hasOpenedBefore, setHasOpenedBefore] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<string | null>(null);
  const [viewerSource, setViewerSource] = useState<Source | null>(null);
  const summaryAttempted = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Position ────────────────────────────────────────────────────────────
  // `position` state is used only for the initial render and the chat-window
  // style prop.  During drag we never call setState — that would trigger a
  // re-render that overwrites the direct DOM updates we make in the listener.
  const [position, setPosition] = useState({ x: 0, y: 0 });
  // positionRef is the live source-of-truth while dragging.
  const positionRef = useRef({ x: 0, y: 0 });

  const [isClient, setIsClient] = useState(false);

  // ─── Drag – pure refs, zero re-renders during drag ───────────────────────
  const isDragging = useRef(false);
  const dragTarget = useRef<'bubble' | 'window' | null>(null);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, bubbleX: 0, bubbleY: 0, wLeft: 0, wTop: 0 });
  const dragDistance = useRef(0);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const windowSide = useRef<'left' | 'right'>('left');

  const applyWindowStyle = useCallback((el: HTMLDivElement, bx: number, by: number) => {
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      el.style.left = "16px";
      el.style.right = "16px";
      el.style.top = "16px";
      el.style.bottom = "96px";
      el.style.width = "auto";
      el.style.height = "auto";
    } else {
      const W = 380, H = 520;
      let side = windowSide.current;

      if (dragTarget.current !== 'window') {
        if (side === 'left' && bx - W - 16 < 16) {
          side = 'right';
        } else if (side === 'right' && bx + 72 + W > window.innerWidth - 16) {
          if (bx - W - 16 >= 16) {
            side = 'left';
          }
        }
      }
      
      windowSide.current = side;

      let left = side === 'right' ? bx + 72 : bx - W - 16;
      let top = by - H + 56;

      if (left < 16) left = 16;
      if (left + W > window.innerWidth - 16) left = window.innerWidth - W - 16;
      if (top < 16) top = 16;
      if (top + H > window.innerHeight - 16) top = window.innerHeight - H - 16;

      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.right = "";
      el.style.bottom = "";
      el.style.width = `${W}px`;
      el.style.height = `${H}px`;
    }
  }, []);

  // ─── Thread ───────────────────────────────────────────────────────────────
  const [threadId, setThreadId] = useState<string>("");

  // Whenever position state changes (drag end / init) or window is opened, sync ref + apply to DOM.
  // Because left/top are NOT in the bubble's and window's style props, React won't overwrite
  // them on future re-renders triggered by unrelated state changes.
  useEffect(() => {
    positionRef.current = position;
    if (bubbleRef.current) {
      bubbleRef.current.style.left = `${position.x}px`;
      bubbleRef.current.style.top = `${position.y}px`;
    }
    if (windowRef.current) {
      applyWindowStyle(windowRef.current, position.x, position.y);
    }
  }, [position, isOpen, applyWindowStyle]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsClient(true);

    const initialX = window.innerWidth - 80;
    const initialY = window.innerHeight - 80;
    setPosition({ x: initialX, y: initialY });

    if (!localStorage.getItem("uit_mate_opened")) {
      setHasOpenedBefore(false);
    }

    let tId = localStorage.getItem("uit_mate_thread_id");
    if (!tId) {
      tId = newId();
      localStorage.setItem("uit_mate_thread_id", tId);
    }
    setThreadId(tId);
  }, []);

  const loadMe = useCallback(async () => {
    const r = await apiFetch("/api/v1/me");
    if (!r.ok) {
      setMe(null);
      return;
    }
    setMe(await r.json());
  }, []);

  useEffect(() => {
    if (isClient) {
      void aiMateDbClearOlderThanDays(30).catch(() => {});
      void loadMe();
    }
  }, [isClient, loadMe]);

  useEffect(() => {
    if (threadId) {
      void aiMateDbListThread(threadId)
        .then(setMessages)
        .catch(() => setMessages([]));
    }
  }, [threadId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
    } else {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        setHasUnread(true);
      }
    }
  }, [isOpen, messages]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-uit-mate", handleOpen);
    return () => window.removeEventListener("open-uit-mate", handleOpen);
  }, []);

  // ─── Drag listeners – attached ONCE, never re-attached ───────────────────
  // Uses translate3d during drag (GPU compositor, no layout reflow).
  // Commits final position to left/top only on drag end.
  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      if (!isDragging.current) return;

      const dx = clientX - dragStart.current.mouseX;
      const dy = clientY - dragStart.current.mouseY;
      dragDistance.current = Math.sqrt(dx * dx + dy * dy);

      // GPU-accelerated: same transform for both = perfect sync, zero layout
      const t = `translate3d(${dx}px, ${dy}px, 0)`;
      if (bubbleRef.current) bubbleRef.current.style.transform = t;
      if (windowRef.current) windowRef.current.style.transform = t;

      // Track logical bubble position for onEnd commit
      positionRef.current = {
        x: dragStart.current.bubbleX + dx,
        y: dragStart.current.bubbleY + dy,
      };
    };

    const onEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // Compute final clamped bubble position
      const bx = Math.max(16, Math.min(window.innerWidth - 72, positionRef.current.x));
      const by = Math.max(16, Math.min(window.innerHeight - 72, positionRef.current.y));

      // Commit to left/top with transition still disabled (avoids animated teleport)
      if (bubbleRef.current) {
        bubbleRef.current.style.left = `${bx}px`;
        bubbleRef.current.style.top = `${by}px`;
        bubbleRef.current.style.transform = '';
        bubbleRef.current.style.willChange = '';
      }
      if (windowRef.current) {
        // dragTarget still set here so applyWindowStyle skips side-flip logic
        applyWindowStyle(windowRef.current, bx, by);
        windowRef.current.style.transform = '';
        windowRef.current.style.willChange = '';
        windowRef.current.style.backdropFilter = '';
        (windowRef.current.style as any).webkitBackdropFilter = '';
      }

      dragTarget.current = null;

      // Restore CSS transitions only after the position commit has been painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (bubbleRef.current) bubbleRef.current.style.transition = '';
          if (windowRef.current) windowRef.current.style.transition = '';
        });
      });

      positionRef.current = { x: bx, y: by };
      setPosition({ x: bx, y: by });
      localStorage.setItem("uit_mate_position", JSON.stringify({ x: bx, y: by }));
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) onMove(t.clientX, t.clientY);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [applyWindowStyle]);

  const handleStart = (clientX: number, clientY: number, target: 'bubble' | 'window') => {
    isDragging.current = true;
    dragTarget.current = target;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    // Snapshot current bubble position as the drag origin
    // (translate3d is relative to current left/top, so we just need mouse start)
    dragStart.current = {
      mouseX: clientX,
      mouseY: clientY,
      bubbleX: positionRef.current.x,
      bubbleY: positionRef.current.y,
      wLeft: 0,
      wTop: 0,
    };
    dragDistance.current = 0;

    // Kill CSS transitions + promote to compositor layer
    if (bubbleRef.current) {
      bubbleRef.current.style.transition = 'none';
      bubbleRef.current.style.willChange = 'transform';
    }
    if (windowRef.current) {
      windowRef.current.style.transition = 'none';
      windowRef.current.style.willChange = 'transform';
      windowRef.current.style.backdropFilter = 'none';
      (windowRef.current.style as any).webkitBackdropFilter = 'none';
    }
  };

  const handleBubbleClick = () => {
    if (dragDistance.current < 5) {
      if (!hasOpenedBefore) {
        localStorage.setItem("uit_mate_opened", "1");
        setHasOpenedBefore(true);
      }
      setIsOpen((prev) => !prev);
    }
  };

  // ─── Chat ─────────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || busy || !threadId) return;
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
    setIsOverloaded(null);

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
        const resetIn = body?.detail?.reset_in_seconds || 60;
        setIsOverloaded({ seconds: resetIn });
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
          disclaimer = Boolean(
            (ev.data as { policy_disclaimer_required?: boolean })
              .policy_disclaimer_required,
          );
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
    try {
      // Opt out of API alert, handle locally for better UX
      setPinnedMessage(content);
      await apiFetch("/api/v1/ai-mate/pins", {
        method: "POST",
        headers: { "X-CSRF-Token": me.csrf_token },
        body: JSON.stringify({ content: content.slice(0, 2000) }),
      });
    } catch {
      // Silently fail API, keeping local pin active
    }
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
        body: JSON.stringify({
          session_started_at: sessionStarted,
          messages: transcript,
        }),
      });
      if (!r.ok) {
        summaryAttempted.current = false;
        alert("Không tạo được tóm tắt trên server.");
        return;
      }
      alert("Đã tạo tóm tắt phiên học tập gửi lên máy chủ.");
    } catch {
      summaryAttempted.current = false;
      alert("Không tạo được tóm tắt.");
    }
  }

  async function handleClearChat() {
    if (!threadId) return;
    if (!window.confirm("Bạn có chắc chắn muốn xoá toàn bộ lịch sử chat hiện tại?")) return;
    await aiMateDbDeleteThread(threadId);
    setMessages([]);
    setStreaming("");
    setError(null);
    const newTId = newId();
    localStorage.setItem("uit_mate_thread_id", newTId);
    setThreadId(newTId);
  }

  if (!isClient) return null;

  return (
    <>
      {/* ── Draggable Chat Bubble (hidden when chat is open) ──────────── */}
      {!isOpen && <div
        ref={bubbleRef}
        style={{ position: "fixed", zIndex: 9999 }}
        onMouseDown={(e) => handleStart(e.clientX, e.clientY, 'bubble')}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (touch) handleStart(touch.clientX, touch.clientY, 'bubble');
        }}
        onClick={handleBubbleClick}
        className="w-14 h-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg shadow-black/50 active:scale-95 transition-transform select-none group relative overflow-visible"
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full bg-neutral-600/20 animate-ping opacity-75 pointer-events-none group-hover:animate-none" />

        <img
          src="/ai.png"
          alt="UIT Mate"
          className="w-full h-full rounded-full object-cover pointer-events-none select-none border-2 border-transparent transition-colors"
          draggable={false}
        />
        
        {/* Unread / Typing Badge on Bubble */}
        {!isOpen && (hasUnread || busy) && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-neutral-900 shadow-sm animate-in zoom-in fade-in">
            {busy && (
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
            )}
          </div>
        )}

        {/* Welcome Popup for new users */}
        {!isOpen && !hasOpenedBefore && (
          <div className="absolute bottom-[calc(100%+14px)] right-0 w-56 p-3.5 bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-2xl rounded-br-sm shadow-2xl shadow-black/80 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-500 pointer-events-none">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-xs text-white font-semibold tracking-wide">UIT Mate</p>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Bạn có thắc mắc về điểm số, TKB hay quy chế đào tạo? Hãy hỏi mình nhé!
            </p>
          </div>
        )}
      </div>}

      {/* ── Chat Window ──────────────────────────────────────────────────
          IMPORTANT: left/top are intentionally absent from the style prop.
          React only manages properties it owns — by keeping left/top out of
          the style prop, React's reconciler will never overwrite the values
          we set via direct DOM manipulation during drag.
          The position is applied via the useEffect([position, isOpen]) above. */}
      {isOpen && (
        <div
          ref={windowRef}
          style={{ position: "fixed", zIndex: 9998 }}
          className="bg-neutral-900/95 border border-neutral-800 rounded-2xl shadow-2xl shadow-black/80 flex flex-col backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div
            onMouseDown={(e) => handleStart(e.clientX, e.clientY, 'window')}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (touch) handleStart(touch.clientX, touch.clientY, 'window');
            }}
            className="p-4 bg-neutral-950/80 border-b border-neutral-850 flex items-center justify-between select-none cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2.5">
              <img
                src="/ai.png"
                alt="UIT Mate"
                className="w-9 h-9 rounded-full object-cover border border-neutral-800"
                draggable={false}
              />
              <div>
                <h3 className="text-sm font-semibold text-white">UIT Mate</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-neutral-400 font-medium">
                    Trực tuyến
                  </span>
                </div>
              </div>
            </div>

            <div
              className="flex items-center gap-1"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {messages.length > 0 && (
                <>
                  <button
                    onClick={handleClearChat}
                    title="Xoá lịch sử chat"
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={endSessionSummary}
                    title="Kết thúc và Tóm tắt"
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pinned Message */}
          {pinnedMessage && (
            <div className="bg-neutral-800/80 border-b border-neutral-800 px-4 py-2.5 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-start gap-2 overflow-hidden">
                <Pin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs text-neutral-300 line-clamp-2 italic leading-relaxed">
                  <FormattedText text={pinnedMessage} />
                </div>
              </div>
              <button
                onClick={() => setPinnedMessage(null)}
                className="p-1 hover:bg-neutral-700/50 rounded text-neutral-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-neutral-900/40">
            {messages.length === 0 && !streaming && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <img
                  src="/ai.png"
                  alt="UIT Mate"
                  className="w-12 h-12 rounded-full object-cover border border-neutral-800 mb-1 animate-pulse"
                  draggable={false}
                />
                <h4 className="text-xs font-semibold text-white">
                  Chào mừng bạn đến với UIT Mate!
                </h4>
                <p className="text-[11px] text-neutral-400 max-w-[200px] leading-relaxed">
                  Tôi có thể giải đáp các câu hỏi về chương trình học tập, quy
                  chế đào tạo tại UIT. Hãy thử hỏi tôi nhé!
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-neutral-800 text-white rounded-tr-sm border border-neutral-700/50"
                      : "bg-neutral-850 text-neutral-200 border border-neutral-800 rounded-tl-sm"
                  }`}
                >
                  <FormattedText text={m.content} role={m.role} />
                </div>

                {m.role === "assistant" && (
                  <div className="flex items-center gap-2 mt-1.5 ml-1">
                    <button
                      onClick={() => pinAssistant(m.content)}
                      title="Ghim phản hồi này"
                      className="text-[10px] text-neutral-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <Pin className="w-3 h-3" /> Ghim
                    </button>

                    {m.sources && m.sources.length > 0 && (
                      <span className="text-[10px] text-neutral-600">|</span>
                    )}

                    {m.sources?.map((s, idx) => {
                      const shortTitle = s.document_title?.includes("1393") ? "QĐ 1393" 
                                       : s.document_title?.includes("790") ? "QĐ 790" 
                                       : "Quy chế";
                      return (
                        <button
                          key={idx}
                          title={s.document_title}
                          onClick={() => setViewerSource(s)}
                          className="text-[10px] text-neutral-400 font-medium bg-neutral-800/50 hover:bg-neutral-700/50 px-1.5 py-0.5 rounded border border-neutral-700/50 transition-colors"
                        >
                          [{idx + 1}] {shortTitle}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {streaming && (
              <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed bg-neutral-850 text-neutral-200 border border-neutral-800 rounded-tl-sm">
                  <div className="flex items-end">
                    <FormattedText text={streaming} role="assistant" />
                    <span className="inline-block w-1 h-3 ml-1 mb-0.5 bg-emerald-500/80 animate-pulse rounded-full" />
                  </div>
                </div>
              </div>
            )}

            {busy && !streaming && (
              <div className="flex items-center gap-2.5 text-neutral-500 pl-1">
                <div className="flex space-x-1">
                  <span
                    className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}

            {error && !isOverloaded && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-[11px] text-red-400 animate-in fade-in zoom-in-95">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            {isOverloaded && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-[11px] text-amber-500 animate-in fade-in zoom-in-95">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <p className="font-semibold mb-0.5">Hệ thống đang quá tải!</p>
                  <p>Có quá nhiều người dùng cùng lúc. Vui lòng chờ {isOverloaded.seconds} giây rồi thử lại nhé.</p>
                </div>
              </div>
            )}

            {showDisclaimer && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[10px] text-amber-500/80 leading-relaxed">
                {DISCLAIMER}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Footer input */}
          <div className="p-3 bg-neutral-950/80 border-t border-neutral-850 flex gap-2">
            <input
              type="text"
              placeholder="Hỏi UIT Mate..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              disabled={busy}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 transition-all disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={busy || !input.trim()}
              className="w-9 h-9 shrink-0 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:bg-neutral-800 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Source Viewer Modal */}
      {viewerSource && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setViewerSource(null)}
          />
          <div className="relative w-full max-w-6xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50 rounded-t-2xl shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-white">Trình xem Quy chế</h3>
                <p className="text-xs text-neutral-400 mt-0.5">{viewerSource.document_title}</p>
              </div>
              <button 
                onClick={() => setViewerSource(null)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex overflow-hidden rounded-b-2xl">
              <iframe 
                src={`${apiBaseUrl()}/api/v1/ai-mate/documents/${viewerSource.document_id}/pdf#search=${encodeURIComponent((viewerSource.content || "").slice(0, 80))}`}
                className="flex-1 h-full border-0 bg-neutral-800"
                title={viewerSource.document_title}
              />
              <div className="w-80 shrink-0 border-l border-neutral-800 p-5 overflow-y-auto bg-neutral-900 hidden md:block">
                 <h4 className="text-xs font-bold text-neutral-500 mb-4 uppercase tracking-wider">Đoạn trích xuất</h4>
                 <div className="text-sm text-neutral-300 leading-relaxed">
                   <FormattedText text={viewerSource.content || "Đang xử lý..."} />
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

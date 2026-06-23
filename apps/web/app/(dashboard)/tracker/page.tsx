"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";


/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface RoadmapNode {
  course_id: number;
  course_code: string;
  course_name: string;
  credits: number;
  term_number: number;
  status: string;
  grade_10: number | null;
  grade_4: number | null;
  grade_letter: string | null;
  prerequisites_met: boolean;
  missing_prerequisites: string[];
  elective_group_id: number | null;
  elective_group_name: string | null;
  is_required: boolean;
}

interface ElectiveGroupStatus {
  group_id: number;
  group_name: string;
  rule_type: string;
  required_value: number;
  current_value: number;
  fulfilled: boolean;
}

interface RoadmapData {
  nodes: RoadmapNode[];
  elective_groups: ElectiveGroupStatus[];
  is_preview: boolean;
}

interface GpaOverview {
  gpa_10: number;
  gpa_4: number;
  total_credits: number;
  earned_credits: number;
  daa_dtbc_10?: number | null;
  daa_dtbc_4?: number | null;
  daa_dtbctl_10?: number | null;
  daa_dtbctl_4?: number | null;
  daa_earned_credits?: number | null;
}

type CaptchaPayload = {
  captcha_state_id: string;
  question: string;
  image_base64: string | null;
};

type MeResponse = {
  student_id: string;
  student_code_masked: string;
  has_credential: boolean;
  csrf_token: string;
};

type SyncEvent = {
  stage: string;
  progress_percent: number;
  message: string | null;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  passed: {
    label: "Đã qua",
    color: "text-emerald-300",
    bg: "bg-emerald-900/40 border-emerald-600/60",
    ring: "ring-emerald-500/30",
  },
  in_progress: {
    label: "Đang học",
    color: "text-amber-300",
    bg: "bg-amber-900/40 border-amber-500/60",
    ring: "ring-amber-500/30",
  },
  failed: {
    label: "Rớt",
    color: "text-red-300",
    bg: "bg-red-900/40 border-red-500/60",
    ring: "ring-red-500/30",
  },
  locked: {
    label: "Bị khóa",
    color: "text-neutral-500",
    bg: "bg-neutral-800/60 border-neutral-700/60",
    ring: "ring-neutral-600/20",
  },
  not_started: {
    label: "Chưa học",
    color: "text-neutral-400",
    bg: "bg-neutral-800/40 border-neutral-700/40",
    ring: "ring-neutral-600/20",
  },
};

function statusCfg(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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

/* ------------------------------------------------------------------ */
/* Components                                                         */
/* ------------------------------------------------------------------ */

function GpaBadge({ gpa }: { gpa: GpaOverview }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between outline-none group"
      >
        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest group-hover:text-cyan-300 transition-colors">
          Thông tin chính thức từ trường (DAA)
        </p>
        <span className="text-neutral-500 text-xs">{isOpen ? "Thu gọn ▲" : "Mở rộng ▼"}</span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 pt-2">
           <div className="flex justify-between items-center bg-neutral-800/40 p-3 rounded-lg border border-neutral-700/50">
             <div>
                <p className="text-sm text-neutral-200 font-medium">Điểm trung bình chung (ĐTBC)</p>
                <p className="text-[10px] text-neutral-500 mt-1 max-w-[280px]">Tính điểm tất cả các môn đã học (kể cả rớt), dùng để xét số tín chỉ được đăng ký, học vượt, chuyển ngành hoặc xét khóa luận.</p>
             </div>
             <div className="text-right">
                <p className="text-lg font-bold text-emerald-400">{gpa.daa_dtbc_10?.toFixed(2) || "N/A"}</p>
                {gpa.daa_dtbc_4 != null && <p className="text-[10px] text-neutral-500">Hệ 4: {gpa.daa_dtbc_4.toFixed(2)}</p>}
             </div>
           </div>

           <div className="flex justify-between items-center bg-neutral-800/40 p-3 rounded-lg border border-neutral-700/50">
             <div>
                <p className="text-sm text-neutral-200 font-medium">Điểm trung bình chung tích lũy (ĐTBCTL)</p>
                <p className="text-[10px] text-neutral-500 mt-1 max-w-[280px]">Chỉ tính điểm các môn đã tích lũy (từ 5,0 trở lên), dùng để phân loại kết quả và xếp hạng tốt nghiệp.</p>
             </div>
             <div className="text-right">
                <p className="text-lg font-bold text-amber-400">{gpa.daa_dtbctl_10?.toFixed(2) || "N/A"}</p>
                {gpa.daa_dtbctl_4 != null && <p className="text-[10px] text-neutral-500">Hệ 4: {gpa.daa_dtbctl_4.toFixed(2)}</p>}
             </div>
           </div>

           {gpa.daa_earned_credits != null && gpa.daa_earned_credits > 0 && (
             <div className="flex justify-between items-center bg-neutral-800/40 p-3 rounded-lg border border-neutral-700/50">
               <div>
                  <p className="text-sm text-neutral-200 font-medium">Tín chỉ tích lũy</p>
               </div>
               <div className="text-right">
                  <p className="text-lg font-bold text-white">{gpa.daa_earned_credits} TC</p>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
}

function TreeViewNode({ node }: { node: RoadmapNode }) {
  const cfg = statusCfg(node.status);

  return (
    <div className="hs-accordion-selectable px-2 py-1.5 rounded-md cursor-pointer hover:bg-neutral-800/50 transition-colors group" role="treeitem">
      <div className="flex items-center gap-x-3">
        <div className={`shrink-0 h-2 w-2 rounded-full ${cfg.bg} border border-neutral-600`} />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between grow gap-2">
          <div className="flex flex-col">
             <div className="flex items-center gap-2">
               <span className="text-xs font-mono text-neutral-400">{node.course_code}</span>
               <span className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">{node.course_name}</span>
             </div>
             <div className="flex items-center gap-2 mt-0.5">
               <span className="text-[10px] text-neutral-500">{node.credits} TC</span>
               {node.status === "passed" && node.grade_10 !== null && (
                 <span className={`text-[10px] ${cfg.color}`}>
                   Điểm: {node.grade_10.toFixed(1)} ({node.grade_letter})
                 </span>
               )}
               {node.status === "passed" && node.grade_10 === null && (
                 <span className={`text-[10px] ${cfg.color}`}>Được miễn</span>
               )}
               {node.status === "failed" && (
                 <span className={`text-[10px] text-red-400`}>Rớt - Điểm: {node.grade_10?.toFixed(1)}</span>
               )}
               {node.status === "locked" && node.missing_prerequisites.length > 0 && (
                 <span className={`text-[10px] text-amber-500 truncate max-w-[200px]`}>Tiên quyết: {node.missing_prerequisites.join(", ")}</span>
               )}
             </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
             <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.color} bg-black/20`}>
               {cfg.label}
             </span>
             {!node.is_required && (
               <span className="text-[9px] font-medium text-violet-400 bg-violet-900/20 px-1 rounded">Tự chọn</span>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeViewTerm({ termNumber, nodes }: { termNumber: number; nodes: RoadmapNode[] }) {
  const [isOpen, setIsOpen] = useState(true);
  const isCurrentTerm = nodes.some((n) => n.status === "in_progress");

  return (
    <div className="hs-accordion active" role="treeitem" aria-expanded={isOpen}>
      <div className="hs-accordion-heading py-1 flex items-center gap-x-0.5 w-full">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`size-6 flex justify-center items-center hover:bg-neutral-800 rounded-md focus:outline-none ${isCurrentTerm ? "text-amber-400 hover:text-amber-300" : "text-neutral-400 hover:text-white"}`}
        >
          <svg className={`size-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <div 
          className={`grow px-1.5 py-1 rounded-md cursor-pointer transition-colors ${isCurrentTerm ? "bg-amber-900/10 hover:bg-amber-900/20" : "hover:bg-neutral-800/50"}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-x-3">
            <svg className={`shrink-0 size-4 ${isCurrentTerm ? "text-amber-500" : "text-cyan-500"}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
            <div className="grow flex items-center gap-2">
              <span className={`text-sm font-semibold flex items-center gap-2 ${isCurrentTerm ? "text-amber-400" : "text-cyan-400"}`}>
                Kỳ {termNumber}
              </span>
              <span className={`text-xs ${isCurrentTerm ? "text-amber-500/70" : "text-neutral-500"}`}>({nodes.length} môn)</span>
            </div>
          </div>
        </div>
      </div>
      
      {isOpen && (
        <div className="hs-accordion-content w-full overflow-hidden transition-[height] duration-300">
          <div className={`ms-3 ps-3 relative before:absolute before:top-0 before:inset-s-0 before:-ms-px before:h-full before:border-s space-y-1 my-1 ${isCurrentTerm ? "before:border-amber-800/50" : "before:border-neutral-800"}`}>
            {nodes.map(n => (
              <TreeViewNode key={n.course_id} node={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoadmapTreeView({ sortedTerms }: { sortedTerms: [number, RoadmapNode[]][] }) {
  return (
    <div className="border border-neutral-800/60 rounded-xl bg-neutral-950/80 p-4 backdrop-blur shadow-xl">
      <div className="hs-accordion-treeview-root" role="tree" aria-orientation="vertical">
        <div className="hs-accordion-group" role="group">
          {sortedTerms.map(([term, nodes]) => (
            <TreeViewTerm key={term} termNumber={term} nodes={nodes} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ElectiveGroupBadges({ groups }: { groups: ElectiveGroupStatus[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-neutral-300 mb-2">Nhóm tự chọn</h3>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <div
            key={g.group_id}
            className={`rounded-full border px-3 py-1 text-xs ${
              g.fulfilled
                ? "border-emerald-700 bg-emerald-900/30 text-emerald-300"
                : "border-amber-700 bg-amber-900/30 text-amber-300"
            }`}
          >
            {g.group_name}: {g.current_value}/{g.required_value}{" "}
            {g.rule_type === "credits" ? "TC" : "môn"}
            {g.fulfilled ? " ✓" : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewBanner() {
  return (
    <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 p-4 text-sm text-amber-200">
      <p className="font-medium">📋 Chế độ Preview</p>
      <p className="mt-1 text-amber-300/70">
        Bạn chưa có dữ liệu điểm. Roadmap hiển thị theo CTĐT mẫu của ngành.
        Hãy{" "}
        <Link href="/onboarding" className="underline text-amber-200 hover:text-amber-100">
          đồng bộ dữ liệu
        </Link>{" "}
        để xem trạng thái thực tế.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4">📚</div>
      <h2 className="text-lg font-semibold text-neutral-200">Chưa có CTĐT</h2>
      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        Chương trình đào tạo cho ngành của bạn chưa được thiết lập.
        Hãy liên hệ admin hoặc chờ cập nhật.
      </p>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${cfg.bg} border`} />
          <span className={cfg.color}>{cfg.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DAA Re-sync Panel                                                  */
/* ------------------------------------------------------------------ */

function DaaResyncPanel({
  csrfToken,
  onSyncComplete,
}: {
  csrfToken: string;
  onSyncComplete: () => void;
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

  // Progress display
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
    const stages = ["daa_profile", "daa_grades", "daa_schedule", "daa_exams", "moodle_authenticating", "persisting"];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-400">
            {isCompleted ? "✅ Đồng bộ hoàn tất!" : isFailed ? "❌ Đồng bộ thất bại" : latest?.message || "Đang đồng bộ..."}
          </span>
          <span className="font-mono text-neutral-500">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${isFailed ? "bg-red-500" : isCompleted ? "bg-emerald-500" : "bg-cyan-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="space-y-1">
          {stages.map((stage) => {
            const isDone = completedStages.has(stage) || isCompleted;
            const isActive = stage === activeStage && !isCompleted && !isFailed;
            return (
              <li key={stage} className={`flex items-center gap-2 text-xs ${isDone ? "text-emerald-400" : isActive ? "text-cyan-300" : "text-neutral-600"}`}>
                <span className="w-4 text-center">{isDone ? "✓" : isActive ? "⟳" : "○"}</span>
                <span>{STAGE_LABELS[stage] || stage}</span>
                {isActive && <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />}
              </li>
            );
          })}
        </ul>
        {isFailed && error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-300">Giải captcha DAA</span>
          <button type="button" onClick={() => void loadCaptcha()} className="text-xs text-cyan-400 hover:underline">
            Làm mới
          </button>
        </div>
        {captcha ? (
          <>
            <p className="text-xs text-neutral-400">{captcha.question}</p>
            {imageSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageSrc} alt="Captcha DAA" className="max-h-20 rounded border border-neutral-700" />
            )}
            <input
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none ring-cyan-500 focus:ring-2"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              placeholder="Nhập đáp án captcha"
              required
            />
          </>
        ) : (
          <p className="text-xs text-neutral-500">Đang tải captcha…</p>
        )}
      </div>
      {error && !jobId && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !captcha}
        className="w-full rounded-md bg-cyan-600 py-1.5 text-sm font-medium text-black hover:bg-cyan-500 disabled:opacity-40 transition-colors"
      >
        {busy ? "Đang xử lý…" : "Bắt đầu đồng bộ"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function TrackerPage() {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [gpa, setGpa] = useState<GpaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResync, setShowResync] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roadmapRes, gpaRes, meRes] = await Promise.all([
        apiFetch("/api/v1/tracker/roadmap"),
        apiFetch("/api/v1/tracker/gpa"),
        apiFetch("/api/v1/me"),
      ]);

      if (roadmapRes.status === 401 || gpaRes.status === 401) {
        setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        return;
      }

      if (!roadmapRes.ok || !gpaRes.ok) {
        setError("Không thể tải dữ liệu. Vui lòng thử lại.");
        return;
      }

      if (meRes.ok) {
        setMe(await meRes.json());
      }

      const roadmapRaw = (await roadmapRes.json()) as RoadmapData;
      const gpaRaw = (await gpaRes.json()) as GpaOverview;
      const normalizedRoadmap: RoadmapData = {
        ...roadmapRaw,
        nodes: (roadmapRaw.nodes ?? []).map((n) => ({
          ...n,
          course_id: asNumber(n.course_id),
          credits: asNumber(n.credits),
          term_number: asNumber(n.term_number),
          grade_10: asNullableNumber(n.grade_10),
          grade_4: asNullableNumber(n.grade_4),
        })),
        elective_groups: (roadmapRaw.elective_groups ?? []).map((g) => ({
          ...g,
          group_id: asNumber(g.group_id),
          required_value: asNumber(g.required_value),
          current_value: asNumber(g.current_value),
        })),
        is_preview: Boolean(roadmapRaw.is_preview),
      };
      const normalizedGpa: GpaOverview = {
        gpa_10: asNumber(gpaRaw.gpa_10),
        gpa_4: asNumber(gpaRaw.gpa_4),
        total_credits: asNumber(gpaRaw.total_credits),
        earned_credits: asNumber(gpaRaw.earned_credits),
        daa_dtbc_10: asNullableNumber(gpaRaw.daa_dtbc_10),
        daa_dtbc_4: asNullableNumber(gpaRaw.daa_dtbc_4),
        daa_dtbctl_10: asNullableNumber(gpaRaw.daa_dtbctl_10),
        daa_dtbctl_4: asNullableNumber(gpaRaw.daa_dtbctl_4),
        daa_earned_credits: asNullableNumber(gpaRaw.daa_earned_credits),
      };

      setRoadmap(normalizedRoadmap);
      setGpa(normalizedGpa);
    } catch {
      setError("Lỗi kết nối. Kiểm tra kết nối mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResyncComplete = useCallback(() => {
    setShowResync(false);
    void load();
  }, [load]);

  // Group nodes by term
  const termGroups = new Map<number, RoadmapNode[]>();
  if (roadmap) {
    for (const node of roadmap.nodes) {
      const list = termGroups.get(node.term_number) ?? [];
      list.push(node);
      termGroups.set(node.term_number, list);
    }
  }
  const sortedTerms = [...termGroups.entries()].sort(([a], [b]) => a - b);

  return (
    <main>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Academic Tracker</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Lộ trình học tập</h1>
          </div>
          <div className="flex gap-3">
            {me?.has_credential && (
              <button
                type="button"
                onClick={() => setShowResync((v) => !v)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  showResync
                    ? "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                    : "bg-gradient-to-r from-emerald-700 to-cyan-700 text-white shadow hover:from-emerald-600 hover:to-cyan-600"
                }`}
              >
                {showResync ? "✕ Đóng" : "🔄 Cập nhật điểm DAA"}
              </button>
            )}
            <Link
              href="/tracker/gpa-tools"
              className="rounded-lg bg-gradient-to-r from-violet-700 to-cyan-700 px-4 py-2 text-sm font-medium text-white shadow hover:from-violet-600 hover:to-cyan-600 transition-all"
            >
              🧮 GPA Tools
            </Link>
          </div>
        </div>

        {/* Re-sync panel */}
        {showResync && me && (
          <div className="mb-6 rounded-xl border border-cyan-800/40 bg-neutral-950/60 p-5 backdrop-blur">
            <h2 className="mb-3 text-sm font-semibold text-cyan-300">Cập nhật điểm từ DAA</h2>
            <p className="mb-4 text-xs text-neutral-500">
              Giải captcha DAA để đồng bộ lại điểm, TKB và lịch thi. Không cần nhập lại mật khẩu.
            </p>
            <DaaResyncPanel csrfToken={me.csrf_token} onSyncComplete={handleResyncComplete} />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-lg border border-red-800/40 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Content */}
        {!loading && !error && roadmap && gpa && (
          <div className="space-y-8">
            {/* GPA Summary */}
            <GpaBadge gpa={gpa} />

            {/* Preview banner */}
            {roadmap.nodes.length > 0 && roadmap.is_preview && <PreviewBanner />}

            {/* Empty state */}
            {roadmap.nodes.length === 0 && <EmptyState />}

            {/* Legend */}
            {roadmap.nodes.length > 0 && <StatusLegend />}

            {/* Roadmap Tree */}
            {sortedTerms.length > 0 && (
              <RoadmapTreeView sortedTerms={sortedTerms} />
            )}

            {/* Elective groups */}
            <ElectiveGroupBadges groups={roadmap.elective_groups} />
          </div>
        )}
      </div>
    </main>
  );
}


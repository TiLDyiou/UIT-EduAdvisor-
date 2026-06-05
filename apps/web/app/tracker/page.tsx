"use client";

import { useCallback, useEffect, useState } from "react";
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

/* ------------------------------------------------------------------ */
/* Components                                                         */
/* ------------------------------------------------------------------ */

function GpaCardWithTooltip({
  title,
  value10,
  value4,
  theme,
  tooltipText,
}: {
  title: string;
  value10: number | null | undefined;
  value4: number | null | undefined;
  theme: "cyan" | "violet" | "emerald" | "amber";
  tooltipText: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const themeClasses = {
    cyan: "border-cyan-800/40 bg-gradient-to-br from-cyan-950/60 to-neutral-900/80 text-cyan-400",
    violet: "border-violet-800/40 bg-gradient-to-br from-violet-950/60 to-neutral-900/80 text-violet-400",
    emerald: "border-emerald-800/40 bg-gradient-to-br from-emerald-950/60 to-neutral-900/80 text-emerald-400",
    amber: "border-amber-800/40 bg-gradient-to-br from-amber-950/60 to-neutral-900/80 text-amber-400",
  };

  const hasValue = value10 !== null && value10 !== undefined && value10 > 0;

  return (
    <div
      className={`relative flex-1 min-w-[200px] rounded-xl border p-4 backdrop-blur transition-all duration-300 hover:scale-[1.03] hover:shadow-lg cursor-help ${themeClasses[theme]}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider font-semibold">{title}</p>
        <span className="text-xs opacity-60">ⓘ</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold tracking-tight text-white">
          {hasValue ? value10!.toFixed(2) : "N/A"}
        </p>
        {hasValue && value4 !== null && value4 !== undefined && value4 > 0 && (
          <p className="text-sm font-medium text-neutral-400">
            (Hệ 4: {value4!.toFixed(2)})
          </p>
        )}
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 z-50 mb-3 w-64 -translate-x-1/2 rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-200 shadow-2xl backdrop-blur">
          <div className="relative">
            <p className="leading-relaxed whitespace-normal break-words">{tooltipText}</p>
            <div className="absolute -bottom-4 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-neutral-700 bg-neutral-950" />
          </div>
        </div>
      )}
    </div>
  );
}

function GpaBadge({ gpa }: { gpa: GpaOverview }) {
  return (
    <div className="space-y-6">
      {/* Self-calculated academic values */}
      <div>
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Tự động tính (Học kỳ hiện tại)</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[140px] rounded-xl border border-cyan-800/40 bg-gradient-to-br from-cyan-950/60 to-neutral-900/80 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-cyan-400">GPA Thang 10 (Ước tính)</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-white">
              {gpa.gpa_10.toFixed(2)}
            </p>
          </div>
          <div className="flex-1 min-w-[140px] rounded-xl border border-violet-800/40 bg-gradient-to-br from-violet-950/60 to-neutral-900/80 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-violet-400">GPA Thang 4 (Ước tính)</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-white">
              {gpa.gpa_4.toFixed(2)}
            </p>
          </div>
          <div className="flex-1 min-w-[140px] rounded-xl border border-neutral-700/40 bg-neutral-900/60 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Tín chỉ tích lũy</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-white">
              {gpa.earned_credits}
              <span className="text-base text-neutral-500">/{gpa.total_credits}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Official values from school (DAA) */}
      <div>
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Thông tin chính thức từ trường (DAA)</p>
        <div className="flex flex-wrap gap-4">
          <GpaCardWithTooltip
            title="ĐTBC (DAA)"
            value10={gpa.daa_dtbc_10}
            value4={gpa.daa_dtbc_4}
            theme="emerald"
            tooltipText="Điểm trung bình chung (ĐTBC): Tính điểm tất cả các môn đã học (kể cả rớt), dùng để xét số tín chỉ được đăng ký, học vượt, chuyển ngành hoặc xét điều kiện làm khóa luận tốt nghiệp."
          />
          <GpaCardWithTooltip
            title="ĐTBCTL (DAA)"
            value10={gpa.daa_dtbctl_10}
            value4={gpa.daa_dtbctl_4}
            theme="amber"
            tooltipText="Điểm trung bình chung tích lũy (ĐTBCTL): Chỉ tính điểm các môn đã tích lũy (từ 5,0 trở lên), dùng để phân loại kết quả và xếp hạng tốt nghiệp."
          />
          {gpa.daa_earned_credits != null && gpa.daa_earned_credits > 0 && (
            <div className="flex-1 min-w-[140px] rounded-xl border border-neutral-700/40 bg-neutral-900/60 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wider text-neutral-400">TC tích lũy (DAA)</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-white">
                {gpa.daa_earned_credits}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CourseNode({ node }: { node: RoadmapNode }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cfg = statusCfg(node.status);

  return (
    <div
      className={`relative rounded-lg border p-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-default ${cfg.bg} hover:ring-2 ${cfg.ring}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-neutral-400">{node.course_code}</p>
          <p className="mt-0.5 text-sm font-medium text-neutral-100 truncate">
            {node.course_name}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color} bg-black/20`}>
          {cfg.label}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
        <span>{node.credits} TC</span>
        {node.grade_10 !== null && (
          <span className={cfg.color}>
            {node.grade_10.toFixed(1)} ({node.grade_letter})
          </span>
        )}
        {!node.is_required && (
          <span className="text-violet-400">Tự chọn</span>
        )}
      </div>

      {/* Tooltip on hover */}
      {showTooltip && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-neutral-700 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur text-xs">
          {node.status === "passed" && node.grade_10 !== null && (
            <p>
              Điểm: <span className="text-emerald-300 font-medium">{node.grade_10.toFixed(1)}</span>{" "}
              (Thang 4: {node.grade_4?.toFixed(1)}) — {node.grade_letter}
            </p>
          )}
          {node.status === "failed" && (
            <p className="text-red-300">
              ⚠ Rớt – cần học lại. Điểm: {node.grade_10?.toFixed(1)}
            </p>
          )}
          {node.status === "locked" && node.missing_prerequisites.length > 0 && (
            <p className="text-neutral-400">
              🔒 Tiên quyết còn thiếu:{" "}
              <span className="text-amber-300">{node.missing_prerequisites.join(", ")}</span>
            </p>
          )}
          {node.status === "in_progress" && (
            <p className="text-amber-300">📖 Đang học kỳ hiện tại</p>
          )}
          {node.status === "not_started" && node.prerequisites_met && (
            <p className="text-neutral-400">Sẵn sàng đăng ký</p>
          )}
          {node.elective_group_name && (
            <p className="mt-1 text-violet-400">
              Nhóm tự chọn: {node.elective_group_name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TermColumn({ termNumber, nodes }: { termNumber: number; nodes: RoadmapNode[] }) {
  return (
    <div className="min-w-[220px] flex-1">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-cyan-800/40 to-transparent" />
        <h3 className="shrink-0 text-xs font-semibold uppercase tracking-wider text-cyan-400">
          Kỳ {termNumber}
        </h3>
        <div className="h-px flex-1 bg-gradient-to-l from-cyan-800/40 to-transparent" />
      </div>
      <div className="space-y-2">
        {nodes.map((n) => (
          <CourseNode key={n.course_id} node={n} />
        ))}
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
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function TrackerPage() {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [gpa, setGpa] = useState<GpaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roadmapRes, gpaRes] = await Promise.all([
        apiFetch("/api/v1/tracker/roadmap"),
        apiFetch("/api/v1/tracker/gpa"),
      ]);

      if (roadmapRes.status === 401 || gpaRes.status === 401) {
        setError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        return;
      }

      if (!roadmapRes.ok || !gpaRes.ok) {
        setError("Không thể tải dữ liệu. Vui lòng thử lại.");
        return;
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
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Academic Tracker</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Lộ trình học tập</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/tracker/gpa-tools"
              className="rounded-lg bg-gradient-to-r from-violet-700 to-cyan-700 px-4 py-2 text-sm font-medium text-white shadow hover:from-violet-600 hover:to-cyan-600 transition-all"
            >
              🧮 GPA Tools
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-cyan-700 transition-colors"
            >
              ← Trang chủ
            </Link>
          </div>
        </div>

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
            {roadmap.is_preview && <PreviewBanner />}

            {/* Empty state */}
            {roadmap.nodes.length === 0 && !roadmap.is_preview && <EmptyState />}

            {/* Legend */}
            {roadmap.nodes.length > 0 && <StatusLegend />}

            {/* Roadmap grid */}
            {sortedTerms.length > 0 && (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {sortedTerms.map(([term, nodes]) => (
                    <TermColumn key={term} termNumber={term} nodes={nodes} />
                  ))}
                </div>
              </div>
            )}

            {/* Elective groups */}
            <ElectiveGroupBadges groups={roadmap.elective_groups} />
          </div>
        )}
      </div>
    </main>
  );
}

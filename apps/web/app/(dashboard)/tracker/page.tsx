"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GpaHistoryChart } from "@/components/GpaHistoryChart";
import { apiFetch } from "@/lib/api";
import {
  Calendar,
  Clock,
  TrendingUp,
  Award,
  BookOpen,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  Circle,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Check,
  ListTodo,
  Lock,
  Sparkles,
} from "lucide-react";

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
  prerequisites_met: boolean;
  missing_prerequisites: string[];
  elective_group_id: number | null;
  elective_group_name: string | null;
  is_required: boolean;
  detailed_grades?: Record<string, number> | null;
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
  total_credits?: number | null;
}

interface GpaOverview {
  gpa_10: number;
  total_credits: number;
  earned_credits: number;
  daa_dtbc_10?: number | null;
  daa_dtbctl_10?: number | null;
  daa_earned_credits?: number | null;
}

type MeResponse = {
  student_id: string;
  student_code_masked: string;
  has_credential: boolean;
  csrf_token: string;
};

interface ExamData {
  id: number;
  course_code: string;
  course_name: string;
  term_code: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  kind: string | null;
}

interface DeadlineData {
  id: number;
  course_code: string | null;
  course_name: string | null;
  title: string;
  due_at: string;
  source: string;
  source_url: string | null;
  completed_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Helpers & Mock Data                                                */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    iconColor: string;
  }
> = {
  passed: {
    label: "Đã qua",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    iconColor: "text-emerald-500 dark:text-emerald-400",
  },
  in_progress: {
    label: "Đang học",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
    iconColor: "text-amber-500 dark:text-amber-400",
  },
  failed: {
    label: "Chưa đạt",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-500/10",
    border: "border-red-200 dark:border-red-500/20",
    iconColor: "text-red-500 dark:text-red-400",
  },
  locked: {
    label: "Bị khóa",
    color: "text-neutral-500 dark:text-neutral-500",
    bg: "bg-neutral-200 dark:bg-neutral-800/40",
    border: "border-neutral-300 dark:border-neutral-700/20",
    iconColor: "text-neutral-400 dark:text-neutral-600",
  },
  not_started: {
    label: "Chưa học",
    color: "text-slate-500 dark:text-neutral-400",
    bg: "bg-slate-100 dark:bg-neutral-800/20",
    border: "border-slate-200 dark:border-neutral-800/40",
    iconColor: "text-slate-400 dark:text-neutral-500",
  },
};

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

function getClassification(score: number | null | undefined): string {
  if (score === null || score === undefined) return "Chưa xếp loại";
  if (score >= 9.0) return "Xuất sắc";
  if (score >= 8.0) return "Giỏi";
  if (score >= 7.0) return "Khá";
  if (score >= 5.0) return "Trung bình";
  return "Yếu";
}

function getClassificationColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-slate-500 dark:text-neutral-400";
  if (score >= 9.0) return "text-cyan-500 dark:text-cyan-400";
  if (score >= 8.0) return "text-emerald-500 dark:text-emerald-400";
  if (score >= 7.0) return "text-amber-500 dark:text-amber-400";
  if (score >= 5.0) return "text-slate-500 dark:text-slate-400";
  return "text-rose-500 dark:text-rose-400";
}

function getDeadlineStatus(dueAtStr: string, isCompleted: boolean) {
  if (isCompleted)
    return {
      label: "Đã hoàn thành",
      color: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
    };
  const due = new Date(dueAtStr);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  if (diff < 0) {
    return {
      label: "Quá hạn",
      color: "text-red-400 bg-red-950/40 border-red-800/40",
    };
  }
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) {
    return {
      label: `Còn ${hours} giờ`,
      color: "text-rose-400 bg-rose-950/40 border-rose-800/40 animate-pulse",
    };
  }
  const days = Math.floor(hours / 24);
  if (days < 3) {
    return {
      label: `Còn ${days} ngày`,
      color: "text-amber-400 bg-amber-950/40 border-amber-800/40",
    };
  }
  return {
    label: `Còn ${days} ngày`,
    color: "text-neutral-400 bg-neutral-900/50 border-neutral-800/50",
  };
}

const MOCK_EXAMS: ExamData[] = [
  {
    id: 101,
    course_code: "IT003",
    course_name: "Cấu trúc dữ liệu và giải thuật",
    term_code: "HK2_2025-2026",
    exam_date: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0], // 3 days from now
    start_time: "07:30:00",
    end_time: "09:30:00",
    room: "C301",
    kind: "Cuối kỳ",
  },
  {
    id: 102,
    course_code: "MA003",
    course_name: "Đại số tuyến tính",
    term_code: "HK2_2025-2026",
    exam_date: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0], // 7 days from now
    start_time: "13:30:00",
    end_time: "15:30:00",
    room: "A205",
    kind: "Cuối kỳ",
  },
  {
    id: 103,
    course_code: "IT004",
    course_name: "Cơ sở dữ liệu",
    term_code: "HK2_2025-2026",
    exam_date: new Date(Date.now() + 86400000 * 11).toISOString().split("T")[0], // 11 days from now
    start_time: "08:00:00",
    end_time: "10:00:00",
    room: "B102",
    kind: "Cuối kỳ",
  },
];

const MOCK_DEADLINES: DeadlineData[] = [
  {
    id: 201,
    course_code: "IT003",
    course_name: "Cấu trúc dữ liệu và giải thuật",
    title: "Nộp đồ án thực hành: Quản lý thư viện sử dụng cây BST",
    due_at: new Date(Date.now() + 86400000 * 1.5).toISOString(), // 1.5 days from now
    source: "moodle",
    source_url: "https://moodle.uit.edu.vn",
    completed_at: null,
  },
  {
    id: 202,
    course_code: "IT004",
    course_name: "Cơ sở dữ liệu",
    title: "Bài tập lớn thiết kế lược đồ ERD & Lược đồ quan hệ",
    due_at: new Date(Date.now() + 86400000 * 3.8).toISOString(), // 3.8 days from now
    source: "moodle",
    source_url: "https://moodle.uit.edu.vn",
    completed_at: null,
  },
  {
    id: 203,
    course_code: "MA003",
    course_name: "Đại số tuyến tính",
    title: "Bài tập trắc nghiệm số 3 trên hệ thống Moodle",
    due_at: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago (completed)
    source: "moodle",
    source_url: "https://moodle.uit.edu.vn",
    completed_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/* Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function TreeViewNode({ node }: { node: RoadmapNode }) {
  const cfg = STATUS_CONFIG[node.status] || STATUS_CONFIG.not_started;
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = Boolean(
    node.detailed_grades && Object.keys(node.detailed_grades).length > 0,
  );

  return (
    <div
      className={`border rounded-xl transition-all duration-300 overflow-hidden ${isExpanded ? "border-slate-300 dark:border-neutral-700 bg-slate-100/50 dark:bg-neutral-900/30" : "border-slate-200 dark:border-neutral-800/40 bg-slate-50 dark:bg-neutral-950/20 hover:border-slate-300 dark:hover:border-neutral-700 hover:bg-slate-100/80 dark:hover:bg-neutral-900/10"}`}
      onClick={() => {
        if (hasDetails) {
          setIsExpanded(!isExpanded);
        }
      }}
    >
      <div
        className={`p-3.5 flex items-center justify-between gap-4 cursor-pointer select-none ${hasDetails ? "" : "pointer-events-none"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            {node.status === "passed" && (
              <div className="size-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Check className="size-3 text-emerald-400 stroke-[3]" />
              </div>
            )}
            {node.status === "in_progress" && (
              <div className="size-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <RefreshCw
                  className="size-3 text-amber-400 animate-spin"
                  style={{ animationDuration: "4s" }}
                />
              </div>
            )}
            {node.status === "failed" && (
              <div className="size-5 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="size-3 text-red-500 dark:text-red-400" />
              </div>
            )}
            {node.status === "locked" && (
              <div className="size-5 rounded-full bg-slate-200 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 flex items-center justify-center">
                <Lock className="size-2.5 text-slate-500 dark:text-neutral-500" />
              </div>
            )}
            {node.status === "not_started" && (
              <div className="size-5 rounded-full border border-slate-300 dark:border-neutral-800 flex items-center justify-center">
                <div className="size-1.5 rounded-full bg-slate-400 dark:bg-neutral-700" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#849495] tracking-wider">
                {node.course_code}
              </span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-neutral-200 block truncate">
                {node.course_name}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-neutral-500 font-medium">
              <span>{node.credits} TC</span>
              {node.grade_10 !== null && (
                <>
                  <span className={`text-[10px]  font-bold ${cfg.color}`}>
                    Điểm: {node.grade_10.toFixed(1)}
                  </span>
                </>
              )}
              {node.status === "locked" &&
                node.missing_prerequisites.length > 0 && (
                  <>
                    <span className="text-[9px] text-neutral-750">•</span>
                    <span
                      className="text-[10px] text-amber-500 font-medium truncate max-w-[200px]"
                      title={node.missing_prerequisites.join(", ")}
                    >
                      Cần môn: {node.missing_prerequisites.join(", ")}
                    </span>
                  </>
                )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Badge Tự chọn */}
          <div className="w-[60px] flex justify-end shrink-0">
            {!node.is_required &&
              !/(anh văn|tiếng anh)/i.test(node.course_name) && (
                <span className="text-[9px] font-bold text-violet-400 bg-violet-950/40 border border-violet-900/30 px-2 py-0.5 rounded-full uppercase text-center w-full">
                  Tự chọn
                </span>
              )}
          </div>

          {/* Badge Trạng thái */}
          <div className="w-[72px] flex justify-end shrink-0">
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg} border ${cfg.border} uppercase text-center w-full`}
            >
              {cfg.label}
            </span>
          </div>

          {/* Chevron */}
          <div className="w-5 flex justify-center shrink-0">
            {hasDetails && (
              <div
                className={`text-neutral-500 transition-transform duration-300 ${isExpanded ? "rotate-180 text-cyan-400" : ""}`}
              >
                <ChevronDown className="size-4" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`grid transition-all duration-300 ease-in-out ${isExpanded && hasDetails ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div
            className="border-t border-neutral-200 dark:border-neutral-800/80 bg-slate-50 dark:bg-neutral-950/40 p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px]  font-bold uppercase tracking-wider text-neutral-500">
              Chi tiết điểm thành phần
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(node.detailed_grades!).map(([comp, score]) => {
                const scorePct = (score / 10) * 100;
                return (
                  <div
                    key={comp}
                    className="bg-white dark:bg-neutral-950/30 rounded-xl p-3 border border-neutral-200 dark:border-neutral-850"
                  >
                    <span
                      className="text-neutral-500 text-[9px] uppercase tracking-wider block font-semibold truncate"
                      title={comp}
                    >
                      {comp}
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-base font-black text-neutral-200">
                        {score.toFixed(1)}
                      </span>
                      <span className="text-[9px] text-neutral-500">/10</span>
                    </div>

                    <div className="h-1 rounded-full bg-tokyo-night overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full ${score >= 5 ? "bg-cyan-500" : "bg-rose-500"}`}
                        style={{ width: `${scorePct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeViewTerm({
  termNumber,
  nodes,
}: {
  termNumber: number;
  nodes: RoadmapNode[];
}) {
  const isCurrentTerm = nodes.some((n) => n.status === "in_progress");
  const [isOpen, setIsOpen] = useState(isCurrentTerm);

  const totalTC = nodes.reduce((sum, n) => sum + n.credits, 0);
  const passedTC = nodes
    .filter((n) => n.status === "passed")
    .reduce((sum, n) => sum + n.credits, 0);

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 ${isCurrentTerm ? "border-amber-500/20 bg-amber-500/[0.02] hover:border-amber-500/30" : "border-slate-200 dark:border-neutral-800/80 bg-slate-50/50 dark:bg-neutral-900/10 hover:border-slate-300 dark:hover:border-neutral-700/80"}`}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl flex items-center justify-center ${isCurrentTerm ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"}`}
          >
            <BookOpen className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-extrabold ${isCurrentTerm ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-neutral-100"}`}
              >
                Học kỳ {termNumber}
              </span>
              {isCurrentTerm && (
                <span className="text-[8px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full animate-pulse">
                  Đang diễn ra
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400">
              <span>{nodes.length} môn học</span>
              <span>•</span>
              <span>
                Tích lũy: {passedTC}/{totalTC} TC
              </span>
            </div>
          </div>
        </div>

        <button className="p-1 text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-350 focus:outline-none transition-transform duration-205">
          <ChevronDown
            className={`size-4.5 transition-transform ${isOpen ? "rotate-180 text-cyan-600 dark:text-cyan-400" : ""}`}
          />
        </button>
      </div>

      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="p-4 pt-0 border-t border-neutral-800/20">
            <div className="space-y-2 mt-3">
              {nodes.map((n) => (
                <TreeViewNode key={n.course_id} node={n} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoadmapTreeView({
  sortedTerms,
}: {
  sortedTerms: [number, RoadmapNode[]][];
}) {
  return (
    <div className="space-y-4">
      {sortedTerms.map(([term, nodes], idx) => (
        <div 
          key={term}
          className="opacity-0 animate-[fade-in-up_0.5s_ease-out_forwards]"
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          <TreeViewTerm termNumber={term} nodes={nodes} />
        </div>
      ))}
    </div>
  );
}

function ElectiveGroupBadges({ groups }: { groups: ElectiveGroupStatus[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="pt-5 border-t border-slate-200 dark:border-neutral-800/60 mt-6 anim-fade-in delay-300">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
        <Award className="size-5 text-tokyo-cyan" />
        Điều kiện nhóm tự chọn
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {groups.map((g) => (
          <div
            key={g.group_id}
            className={`p-3.5 rounded-xl border flex flex-col justify-between dark:bg-neutral-950/20 bg-slate-50 ${
              g.fulfilled
                ? "border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/20 bg-amber-500/[0.02] text-amber-600 dark:text-amber-400"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-slate-700 dark:text-neutral-250">
                {g.group_name}
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border  ${g.fulfilled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"}`}
              >
                {g.fulfilled ? "Đạt" : "Chưa đạt"}
              </span>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-slate-800 dark:text-neutral-100">
                  {g.current_value}
                </span>
                <span className="text-xs text-slate-500 dark:text-neutral-500">
                  / {g.required_value}{" "}
                  {g.rule_type === "credits" ? "TC" : "môn"}
                </span>
              </div>

              <div className="h-1 rounded-full bg-slate-200 dark:bg-neutral-850 overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full ${g.fulfilled ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"}`}
                  style={{
                    width: `${Math.min(100, (g.current_value / g.required_value) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewBanner() {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-250 flex items-start gap-3.5 anim-fade-in">
      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
        <AlertTriangle className="size-4.5" />
      </div>
      <div>
        <p className="font-bold text-amber-400 text-xs uppercase tracking-wider ">
          Chế độ Demo / Preview
        </p>
        <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
          Tài khoản của bạn chưa có dữ liệu điểm chính thức. Lộ trình học tập,
          lịch thi và deadline hiện tại đang được hiển thị dưới dạng dữ liệu
          mẫu. Vui lòng{" "}
          <Link
            href="/onboarding"
            className="underline font-bold text-cyan-400 hover:text-cyan-300"
          >
            đồng bộ tài khoản
          </Link>{" "}
          để xem thông tin thực tế của bạn.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-neutral-900/10 rounded-2xl border border-neutral-800/40">
      <div className="p-4 rounded-full bg-neutral-900 border border-neutral-850 mb-4">
        <BookOpen className="size-8 text-neutral-650" />
      </div>
      <h2 className="text-base font-bold text-neutral-200">
        Chưa có chương trình đào tạo
      </h2>
      <p className="mt-2 max-w-sm text-xs text-neutral-500 leading-relaxed">
        Chương trình đào tạo cho ngành học của bạn chưa được thiết lập trên hệ
        thống. Hãy liên hệ ban quản trị để được hỗ trợ.
      </p>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs bg-white dark:bg-neutral-900 p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800/40 inline-flex">
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${cfg.bg} border ${cfg.border}`}
          />
          <span
            className={`text-[10px] font-bold uppercase  tracking-wider ${cfg.color}`}
          >
            {cfg.label}
          </span>
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
  const [me, setMe] = useState<MeResponse | null>(null);
  const [exams, setExams] = useState<ExamData[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineData[]>([]);
  const [completedDeadlineIds, setCompletedDeadlineIds] = useState<number[]>(
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roadmapRes, gpaRes, meRes, examsRes, deadlinesRes] =
        await Promise.all([
          apiFetch("/api/v1/tracker/roadmap"),
          apiFetch("/api/v1/tracker/gpa"),
          apiFetch("/api/v1/me"),
          apiFetch("/api/v1/tracker/exams"),
          apiFetch("/api/v1/tracker/deadlines"),
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
          detailed_grades: n.detailed_grades ?? null,
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
        total_credits: asNumber(gpaRaw.total_credits),
        earned_credits: asNumber(gpaRaw.earned_credits),
        daa_dtbc_10: asNullableNumber(gpaRaw.daa_dtbc_10),
        daa_dtbctl_10: asNullableNumber(gpaRaw.daa_dtbctl_10),
        daa_earned_credits: asNullableNumber(gpaRaw.daa_earned_credits),
      };

      setRoadmap(normalizedRoadmap);
      setGpa(normalizedGpa);

      let fetchedExams: ExamData[] = [];
      if (examsRes.ok) {
        try {
          fetchedExams = await examsRes.json();
        } catch (e) {
          console.error("Failed to parse exams data", e);
        }
      }

      let fetchedDeadlines: DeadlineData[] = [];
      if (deadlinesRes.ok) {
        try {
          fetchedDeadlines = await deadlinesRes.json();
        } catch (e) {
          console.error("Failed to parse deadlines data", e);
        }
      }

      setExams(fetchedExams);
      setDeadlines(fetchedDeadlines);
    } catch {
      setError("Lỗi kết nối. Kiểm tra kết nối mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDeadline = (id: number) => {
    setCompletedDeadlineIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

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

  // Fallbacks for preview mode - FORCED MOCK DATA FOR USER PREVIEW
  const displayExams = (roadmap?.is_preview ?? true) ? MOCK_EXAMS : exams;
  const allDeadlines = (roadmap?.is_preview ?? true) ? MOCK_DEADLINES : deadlines;
  const displayDeadlines = allDeadlines.filter(
    (d) => new Date(d.due_at).getTime() > Date.now()
  );

  const totalCurriculumCredits = roadmap?.total_credits || 120;
  const currentEarnedCredits =
    gpa?.daa_earned_credits ?? gpa?.earned_credits ?? 0;
  const progressPct = Math.min(
    100,
    Math.round((currentEarnedCredits / totalCurriculumCredits) * 100),
  );

  return (
    <main className="space-y-3 pb-12 relative">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-fade-in {
          opacity: 0;
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .delay-0 { animation-delay: 0ms; }
        .delay-75 { animation-delay: 75ms; }
        .delay-150 { animation-delay: 150ms; }
        .delay-225 { animation-delay: 225ms; }
        .delay-300 { animation-delay: 300ms; }
        
        .dashboard-glow-card {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(63, 63, 70, 0.4);
        }
        .dashboard-glow-card:hover {
          transform: translateY(-4px);
          border-color: rgba(6, 182, 212, 0.3) !important;
          box-shadow: 0 20px 40px -15px rgba(6, 182, 212, 0.15);
        }
        
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4); }
          50% { box-shadow: 0 0 12px 4px rgba(6, 182, 212, 0.15); }
        }
        .pulse-glow-border {
          animation: pulse-glow 2.5s infinite ease-in-out;
        }
        
        .progress-circle-fill {
          transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @keyframes check-bounce {
          0% { transform: scale(0.8); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .anim-check-bounce {
          animation: check-bounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `,
        }}
      />

      {/* Header */}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-xs text-neutral-500  tracking-widest uppercase">
            Đang tải dữ liệu...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300 flex items-start gap-3.5 anim-fade-in">
          <div className="p-2 rounded-xl bg-red-500/10 text-red-400 shrink-0">
            <AlertTriangle className="size-4.5" />
          </div>
          <div>
            <p className="font-bold text-red-400 text-xs uppercase tracking-wider ">
              Đã xảy ra lỗi
            </p>
            <p className="mt-1 text-xs text-neutral-405 leading-relaxed">
              {error}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => load()}
                className="mt-3 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors uppercase  tracking-wider flex items-center gap-1.5"
              >
                <RefreshCw className="size-3.5" /> Thử lại
              </button>
              <Link
                href="/onboarding"
                className="mt-3 text-xs font-bold text-[#7aa2f7] hover:text-[#7dcfff] transition-colors uppercase  tracking-wider flex items-center gap-1.5"
              >
                Đăng nhập / Đồng bộ lại
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Loaded Content Dashboard */}
      {!loading && !error && roadmap && gpa && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Metrics & Roadmap */}
          <div className="lg:col-span-8 space-y-6">
            {/* GPA Summary & Chart Card */}
            <div className="bg-white dark:bg-neutral-900/40 rounded-2xl border border-neutral-200 dark:border-neutral-800/80 p-6 dashboard-glow-card anim-fade-in delay-75 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
                 <div>
                   <h2 className="text-base font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-100 flex items-center gap-2">
                     <TrendingUp className="size-4.5 text-cyan-500 dark:text-cyan-400" />
                     Tổng quan kết quả học tập
                   </h2>
                   <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                     Thống kê điểm số trung bình tích lũy và tiến độ hoàn thành.
                   </p>
                 </div>
                 
                 <div className="flex items-center gap-6 bg-slate-50 dark:bg-neutral-950/30 px-5 py-3 rounded-xl border border-slate-200 dark:border-neutral-850">
                   <div className="text-center flex flex-col items-center">
                     <span className="text-[10px] text-slate-500 dark:text-neutral-400 uppercase tracking-wider block font-semibold mb-1">
                       GPA Tích lũy
                     </span>
                     <div className="flex items-center justify-center gap-2">
                       <span className={`text-xl font-black leading-none ${getClassificationColor(gpa.daa_dtbctl_10 || gpa.gpa_10)}`}>
                         {gpa.daa_dtbctl_10?.toFixed(2) || gpa.gpa_10?.toFixed(2) || "N/A"}
                       </span>
                     </div>
                   </div>
                   
                   <div className="w-px h-8 bg-slate-200 dark:bg-neutral-800/80" />
                   
                   <div className="text-center flex flex-col items-center">
                     <span className="text-[10px] text-slate-500 dark:text-neutral-400 uppercase tracking-wider block font-semibold mb-1">
                       Tín chỉ đạt ({progressPct}%)
                     </span>
                     <span className="text-xl font-black text-slate-800 dark:text-neutral-100 leading-none">
                       {currentEarnedCredits} <span className="text-sm text-slate-500 font-medium">/ {totalCurriculumCredits}</span>
                     </span>
                   </div>
                 </div>
              </div>
              
              <div className="-mx-4 sm:mx-0">
                 <GpaHistoryChart nodes={roadmap.nodes} />
              </div>
            </div>

            {/* Preview banner */}
            {roadmap.nodes.length > 0 && roadmap.is_preview && (
              <PreviewBanner />
            )}

            {/* Empty state */}
            {roadmap.nodes.length === 0 && <EmptyState />}

            {/* LỘ TRÌNH VÀ TIẾN TRÌNH HỌC TẬP CARD */}
            <div className="bg-white dark:bg-neutral-900/40 rounded-2xl border border-slate-200 dark:border-neutral-800/80 p-5 dashboard-glow-card shadow-sm anim-fade-in delay-150">
              {/* Roadmap section */}
              {sortedTerms.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-neutral-800/60 pb-4">
                    <h3 className="text-lg font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-200 flex items-center gap-2">
                      <BookOpen className="size-5 text-tokyo-cyan" />
                      Lộ trình & Tiến trình học tập
                    </h3>
                    <StatusLegend />
                  </div>
                  <RoadmapTreeView sortedTerms={sortedTerms} />
                </div>
              )}

              {/* Elective groups */}
              <ElectiveGroupBadges groups={roadmap.elective_groups} />
            </div>
          </div>

          {/* Right Column: Sync, Exams, Deadlines */}
          <div className="lg:col-span-4 space-y-6">
            {/* Exams Card */}
            <div className="bg-white dark:bg-neutral-900/40 rounded-2xl border border-neutral-200 dark:border-neutral-800/80 p-5 dashboard-glow-card anim-fade-in delay-150 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-neutral-200 dark:border-neutral-800/60 pb-3">
                <h3 className="font-bold text-slate-800 dark:text-neutral-200 flex items-center gap-2 text-xs uppercase tracking-wider">
                  <Calendar className="size-4.5 text-cyan-500 dark:text-cyan-400" />
                  Lịch thi
                </h3>
                <span className="text-[10px] font-bold bg-indigo-100 dark:bg-neutral-800 text-indigo-700 dark:text-neutral-400 px-2.5 py-0.5 rounded-full ">
                  {displayExams.length} môn thi
                </span>
              </div>

              {displayExams.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-neutral-500">
                    Chưa ghi nhận lịch thi sắp tới.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {displayExams.map((e) => {
                    const examDate = new Date(e.exam_date);
                    const isSoon =
                      examDate.getTime() - Date.now() < 86400000 * 3 &&
                      examDate.getTime() - Date.now() > 0;
                    const day = examDate.getDate().toString().padStart(2, "0");
                    const month = `T${(examDate.getMonth() + 1).toString().padStart(2, "0")}`;

                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-neutral-800/50 bg-neutral-950/20 hover:bg-neutral-850/20 transition-all duration-200"
                      >
                        <div
                          className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 border  ${isSoon ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-405 pulse-glow-border" : "bg-neutral-950 border-neutral-800 text-neutral-400"}`}
                        >
                          <span className="text-[8px] uppercase font-bold tracking-wider leading-none">
                            {month}
                          </span>
                          <span className="text-base font-black leading-none mt-1">
                            {day}
                          </span>
                        </div>

                        <div className="grow min-w-0">
                          <p className="text-xs font-bold text-neutral-200 truncate leading-snug">
                            {e.course_name}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[9px]  text-neutral-400">
                              {e.course_code}
                            </span>
                            <span className="text-[9px] text-neutral-700">
                              •
                            </span>
                            <span className="text-[9px] text-neutral-400">
                              Phòng:{" "}
                              <strong className="text-neutral-300 font-semibold">
                                {e.room || "Chưa xếp"}
                              </strong>
                            </span>
                            {e.kind && (
                              <>
                                <span className="text-[9px] text-neutral-700">
                                  •
                                </span>
                                <span className="text-[9px] font-bold text-cyan-400 bg-cyan-950/20 border border-cyan-900/30 px-1.5 rounded">
                                  {e.kind}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right ">
                          <span className="text-xs font-bold text-cyan-450 block">
                            {e.start_time.substring(0, 5)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {roadmap.is_preview && (
                <div className="mt-3 text-center border-t border-neutral-800/40 pt-3">
                  <span className="text-[9px]  text-amber-500 bg-amber-950/20 border border-amber-900/30 px-2 py-0.5 rounded">
                    Dữ liệu mẫu
                  </span>
                </div>
              )}
            </div>

            {/* Deadlines Card */}
            <div className="bg-white dark:bg-neutral-900/40 rounded-2xl border border-neutral-800/80 p-5 dashboard-glow-card anim-fade-in delay-225">
              <div className="flex items-center justify-between mb-4 border-b border-neutral-800/60 pb-3">
                <h3 className="font-bold text-neutral-200 flex items-center gap-2 text-xs uppercase tracking-wider">
                  <Clock className="size-4.5 text-cyan-400" />
                  Deadlines
                </h3>
                <span className="text-[10px] font-bold bg-indigo-100 dark:bg-neutral-800 text-indigo-700  dark:text-neutral-400 px-2 py-0.5 rounded-full">
                  {
                    displayDeadlines.filter(
                      (d) =>
                        !completedDeadlineIds.includes(d.id) && !d.completed_at,
                    ).length
                  }{" "}
                  việc
                </span>
              </div>

              {displayDeadlines.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-neutral-500">
                    Chưa ghi nhận deadline nào sắp tới.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {displayDeadlines.map((d) => {
                    const isCompleted =
                      d.completed_at !== null ||
                      completedDeadlineIds.includes(d.id);
                    const status = getDeadlineStatus(d.due_at, isCompleted);
                    const formattedDue = new Date(d.due_at).toLocaleString(
                      "vi-VN",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    );

                    return (
                      <div
                        key={d.id}
                        className={`p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 bg-neutral-950/20 ${isCompleted ? "border-neutral-900 opacity-55" : "border-neutral-800/60 hover:bg-neutral-850/20"}`}
                      >
                        <button
                          onClick={() => toggleDeadline(d.id)}
                          className={`mt-0.5 shrink-0 transition-colors focus:outline-none ${isCompleted ? "text-emerald-400" : "text-neutral-500 hover:text-cyan-400"}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="size-4.5 text-emerald-400 anim-check-bounce fill-emerald-950/40" />
                          ) : (
                            <Circle className="size-4.5" />
                          )}
                        </button>

                        <div className="grow min-w-0">
                          <p
                            className={`text-xs font-semibold text-neutral-200 leading-snug break-words ${isCompleted ? "line-through text-neutral-500" : ""}`}
                          >
                            {d.title}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {d.course_code && (
                              <span className="text-[9px]  text-cyan-400 bg-cyan-950/30 border border-cyan-900/30 px-1.5 rounded">
                                {d.course_code}
                              </span>
                            )}
                            <span
                              className={`text-[9px] px-1.5 rounded border font-semibold ${status.color}`}
                            >
                              {status.label}
                            </span>
                            <span className="text-[9px] text-neutral-500 ">
                              {formattedDue}
                            </span>
                          </div>
                        </div>

                        {d.source_url && (
                          <a
                            href={d.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-neutral-600 hover:text-cyan-400 transition-colors mt-0.5"
                            title="Đi tới link nguồn"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {roadmap.is_preview && (
                <div className="mt-3 text-center border-t border-neutral-800/40 pt-3">
                  <span className="text-[9px]  text-amber-500 bg-amber-950/20 border border-amber-900/30 px-2 py-0.5 rounded">
                    Dữ liệu mẫu
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

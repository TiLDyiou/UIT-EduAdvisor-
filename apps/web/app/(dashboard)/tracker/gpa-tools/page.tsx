"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface GpaOverview {
  gpa_10: number;
  gpa_4: number;
  total_credits: number;
  earned_credits: number;
}

interface SimulateEntry {
  course_id: number;
  credits: number;
  hypothetical_grade_10: number;
  label?: string;
}

interface ReverseResult {
  required_avg_10: number;
  required_avg_4: number;
  achievable: boolean;
}

interface RetakeResult {
  old_gpa_10: number;
  new_gpa_10: number;
  delta_gpa_10: number;
  old_gpa_4: number;
  new_gpa_4: number;
  delta_gpa_4: number;
}

interface EnrollmentOption {
  id: number;
  course_code: string;
  course_name: string;
  credits: number;
  grade_10: number | null;
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

function normalizeGpaOverview(raw: unknown): GpaOverview {
  const value = (raw ?? {}) as Partial<GpaOverview>;
  return {
    gpa_10: asNumber(value.gpa_10),
    gpa_4: asNumber(value.gpa_4),
    total_credits: asNumber(value.total_credits),
    earned_credits: asNumber(value.earned_credits),
  };
}

/* ------------------------------------------------------------------ */
/* Section Components                                                 */
/* ------------------------------------------------------------------ */

function GpaSummaryCard({ gpa, label }: { gpa: GpaOverview; label: string }) {
  return (
    <div className="rounded-xl border border-neutral-700/40 bg-neutral-900/60 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-wider text-neutral-400 mb-2">{label}</p>
      <div className="flex items-baseline gap-6">
        <div>
          <span className="text-2xl font-bold text-white">{gpa.gpa_10.toFixed(2)}</span>
          <span className="ml-1 text-xs text-neutral-500">/10</span>
        </div>
        <div>
          <span className="text-2xl font-bold text-violet-300">{gpa.gpa_4.toFixed(2)}</span>
          <span className="ml-1 text-xs text-neutral-500">/4</span>
        </div>
        <div className="text-sm text-neutral-400">
          {gpa.earned_credits}/{gpa.total_credits} TC
        </div>
      </div>
    </div>
  );
}

function SimulatorSection({ currentGpa }: { currentGpa: GpaOverview }) {
  const [entries, setEntries] = useState<SimulateEntry[]>([
    { course_id: 0, credits: 3, hypothetical_grade_10: 7.0, label: "" },
  ]);
  const [result, setResult] = useState<{ current: GpaOverview; simulated: GpaOverview } | null>(null);
  const [loading, setLoading] = useState(false);

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      { course_id: 0, credits: 3, hypothetical_grade_10: 7.0, label: "" },
    ]);
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx: number, key: keyof SimulateEntry, value: number | string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, [key]: value } : e)),
    );
  };

  const simulate = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/tracker/gpa/simulate", {
        method: "POST",
        body: JSON.stringify({
          entries: entries.map((e) => ({
            course_id: e.course_id,
            credits: e.credits,
            hypothetical_grade_10: e.hypothetical_grade_10,
          })),
        }),
      });
      if (res.ok) {
        const raw = (await res.json()) as {
          current: unknown;
          simulated: unknown;
        };
        setResult({
          current: normalizeGpaOverview(raw.current),
          simulated: normalizeGpaOverview(raw.simulated),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-simulate on change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (entries.length > 0 && entries.every((e) => e.credits > 0)) {
        simulate();
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return (
    <section className="rounded-xl border border-cyan-800/30 bg-gradient-to-br from-cyan-950/20 to-neutral-900/50 p-5">
      <h2 className="text-lg font-semibold text-cyan-300 mb-4">🔮 GPA Simulator</h2>
      <p className="text-xs text-neutral-400 mb-4">
        Nhập điểm giả định cho các môn đang học/dự kiến – GPA cập nhật realtime.
      </p>

      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Tên môn"
              value={entry.label}
              onChange={(e) => updateEntry(idx, "label", e.target.value)}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-cyan-600 focus:outline-none"
            />
            <input
              type="number"
              min={1}
              max={10}
              value={entry.credits}
              onChange={(e) => updateEntry(idx, "credits", Number(e.target.value))}
              className="w-16 rounded-lg border border-neutral-700 bg-neutral-800/60 px-2 py-2 text-sm text-center text-white focus:border-cyan-600 focus:outline-none"
              title="Tín chỉ"
            />
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={entry.hypothetical_grade_10}
              onChange={(e) => updateEntry(idx, "hypothetical_grade_10", Number(e.target.value))}
              className="w-20 rounded-lg border border-neutral-700 bg-neutral-800/60 px-2 py-2 text-sm text-center text-white focus:border-cyan-600 focus:outline-none"
              title="Điểm dự kiến (thang 10)"
            />
            {entries.length > 1 && (
              <button
                onClick={() => removeEntry(idx)}
                className="text-red-400 hover:text-red-300 text-sm px-1"
                title="Xóa"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addEntry}
        className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        + Thêm môn
      </button>

      {/* Results */}
      {result && !loading && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GpaSummaryCard gpa={result.current} label="GPA hiện tại" />
          <GpaSummaryCard gpa={result.simulated} label="GPA dự kiến" />
        </div>
      )}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-xs text-neutral-400">
          <div className="h-3 w-3 animate-spin rounded-full border border-cyan-400 border-t-transparent" />
          Đang tính...
        </div>
      )}
    </section>
  );
}

function ReverseCalculatorSection() {
  const [targetGpa, setTargetGpa] = useState(7.0);
  const [remainingCredits, setRemainingCredits] = useState(30);
  const [result, setResult] = useState<ReverseResult | null>(null);
  const [loading, setLoading] = useState(false);

  const calculate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/tracker/gpa/reverse", {
        method: "POST",
        body: JSON.stringify({
          target_gpa_10: targetGpa,
          remaining_credits: remainingCredits,
        }),
      });
      if (res.ok) {
        const raw = (await res.json()) as Partial<ReverseResult>;
        setResult({
          required_avg_10: asNumber(raw.required_avg_10),
          required_avg_4: asNumber(raw.required_avg_4),
          achievable: Boolean(raw.achievable),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [targetGpa, remainingCredits]);

  useEffect(() => {
    const timer = setTimeout(calculate, 400);
    return () => clearTimeout(timer);
  }, [calculate]);

  return (
    <section className="rounded-xl border border-violet-800/30 bg-gradient-to-br from-violet-950/20 to-neutral-900/50 p-5">
      <h2 className="text-lg font-semibold text-violet-300 mb-4">🎯 Reverse Calculator</h2>
      <p className="text-xs text-neutral-400 mb-4">
        Nhập GPA mục tiêu và số tín chỉ còn lại – hệ thống tính điểm TB cần đạt.
      </p>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-xs text-neutral-400 block mb-1">GPA mục tiêu (thang 10)</label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={targetGpa}
            onChange={(e) => setTargetGpa(Number(e.target.value))}
            className="w-28 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white focus:border-violet-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Tín chỉ còn lại</label>
          <input
            type="number"
            min={1}
            max={200}
            value={remainingCredits}
            onChange={(e) => setRemainingCredits(Number(e.target.value))}
            className="w-28 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white focus:border-violet-600 focus:outline-none"
          />
        </div>
      </div>

      {result && !loading && (
        <div className="mt-4 rounded-lg border border-neutral-700/40 bg-neutral-800/40 p-4">
          <p className="text-sm text-neutral-300">
            Điểm TB cần đạt:{" "}
            <span className={`text-xl font-bold ${result.achievable ? "text-emerald-300" : "text-red-300"}`}>
              {result.required_avg_10.toFixed(2)}
            </span>
            <span className="text-neutral-500 ml-1">/10</span>
            <span className="text-neutral-500 mx-2">≈</span>
            <span className={`font-bold ${result.achievable ? "text-emerald-300" : "text-red-300"}`}>
              {result.required_avg_4.toFixed(1)}
            </span>
            <span className="text-neutral-500 ml-1">/4</span>
          </p>
          {!result.achievable && (
            <p className="mt-2 text-xs text-red-400">
              ⚠ Không khả thi – mục tiêu GPA quá cao với số tín chỉ còn lại.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function RetakeEstimatorSection({ enrollments }: { enrollments: EnrollmentOption[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newGrade, setNewGrade] = useState(7.0);
  const [result, setResult] = useState<RetakeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const calculate = useCallback(async () => {
    if (selectedId === null) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/tracker/gpa/retake", {
        method: "POST",
        body: JSON.stringify({
          enrollment_id: selectedId,
          new_grade_10: newGrade,
        }),
      });
      if (res.ok) {
        const raw = (await res.json()) as Partial<RetakeResult>;
        setResult({
          old_gpa_10: asNumber(raw.old_gpa_10),
          new_gpa_10: asNumber(raw.new_gpa_10),
          delta_gpa_10: asNumber(raw.delta_gpa_10),
          old_gpa_4: asNumber(raw.old_gpa_4),
          new_gpa_4: asNumber(raw.new_gpa_4),
          delta_gpa_4: asNumber(raw.delta_gpa_4),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId, newGrade]);

  useEffect(() => {
    if (selectedId !== null) {
      const timer = setTimeout(calculate, 400);
      return () => clearTimeout(timer);
    }
  }, [selectedId, newGrade, calculate]);

  // Filter to show only courses that could benefit from retaking (< 8.5)
  const retakeable = enrollments.filter((e) => e.grade_10 !== null && e.grade_10 < 8.5);

  if (retakeable.length === 0) {
    return (
      <section className="rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/20 to-neutral-900/50 p-5">
        <h2 className="text-lg font-semibold text-amber-300 mb-2">🔄 Retake Estimator</h2>
        <p className="text-sm text-neutral-400">Chưa có môn nào phù hợp để tính cải thiện.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/20 to-neutral-900/50 p-5">
      <h2 className="text-lg font-semibold text-amber-300 mb-4">🔄 Retake Estimator</h2>
      <p className="text-xs text-neutral-400 mb-4">
        Chọn môn điểm thấp → nhập điểm mới dự kiến → xem mức tăng GPA.
      </p>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-neutral-400 block mb-1">Chọn môn</label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white focus:border-amber-600 focus:outline-none"
          >
            <option value="">-- Chọn môn --</option>
            {retakeable.map((e) => (
              <option key={e.id} value={e.id}>
                {e.course_code} – {e.course_name} ({e.grade_10?.toFixed(1)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">Điểm mới (thang 10)</label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={newGrade}
            onChange={(e) => setNewGrade(Number(e.target.value))}
            className="w-28 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white focus:border-amber-600 focus:outline-none"
          />
        </div>
      </div>

      {result && !loading && (
        <div className="mt-4 rounded-lg border border-neutral-700/40 bg-neutral-800/40 p-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-neutral-400">GPA cũ</p>
              <p className="text-lg font-bold text-neutral-300">{result.old_gpa_10.toFixed(2)}</p>
            </div>
            <div className="flex items-center text-neutral-600">→</div>
            <div>
              <p className="text-neutral-400">GPA mới</p>
              <p className="text-lg font-bold text-cyan-300">{result.new_gpa_10.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-neutral-400">Thay đổi</p>
              <p className={`text-lg font-bold ${result.delta_gpa_10 >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {result.delta_gpa_10 >= 0 ? "+" : ""}
                {result.delta_gpa_10.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function GpaToolsPage() {
  const [gpa, setGpa] = useState<GpaOverview | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [gpaRes, roadmapRes] = await Promise.all([
          apiFetch("/api/v1/tracker/gpa"),
          apiFetch("/api/v1/tracker/roadmap"),
        ]);
        if (gpaRes.status === 401) {
          setError("Phiên đăng nhập hết hạn.");
          return;
        }
        if (gpaRes.ok) {
          const raw = (await gpaRes.json()) as GpaOverview;
          setGpa(normalizeGpaOverview(raw));
        }
        if (roadmapRes.ok) {
          const data = (await roadmapRes.json()) as {
            nodes: Array<{
              course_id: number | string;
              course_code: string;
              course_name: string;
              credits: number | string;
              grade_10: number | string | null;
            }>;
          };
          // Build enrollment options from roadmap nodes that have grades
          const opts: EnrollmentOption[] = data.nodes
            .map((n) => ({
              id: asNumber(n.course_id),
              course_code: n.course_code,
              course_name: n.course_name,
              credits: asNumber(n.credits),
              grade_10: asNullableNumber(n.grade_10),
            }))
            .filter((n) => n.id > 0 && n.grade_10 !== null)
            .map((n) => ({
              id: n.id,
              course_code: n.course_code,
              course_name: n.course_name,
              credits: n.credits,
              grade_10: n.grade_10,
            }));
          setEnrollments(opts);
        }
      } catch {
        setError("Lỗi kết nối.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main>
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-violet-400">GPA Suite</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Bộ công cụ GPA</h1>
          </div>
          <Link
            href="/tracker"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-violet-700 transition-colors"
          >
            ← Roadmap
          </Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-800/40 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && gpa && (
          <div className="space-y-6">
            <GpaSummaryCard gpa={gpa} label="GPA tích lũy hiện tại" />
            <SimulatorSection currentGpa={gpa} />
            <ReverseCalculatorSection />
            <RetakeEstimatorSection enrollments={enrollments} />
          </div>
        )}
      </div>
    </main>
  );
}

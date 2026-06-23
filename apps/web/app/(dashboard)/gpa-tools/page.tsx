"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface GpaOverview {
  gpa_10: number;
  total_credits: number;
  earned_credits: number;
}

interface ReverseResult {
  required_avg_10: number;
  achievable: boolean;
}

interface RetakeResult {
  old_gpa_10: number;
  new_gpa_10: number;
  delta_gpa_10: number;
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

function asNullableNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function CourseAutocomplete({
  options,
  value,
  onChange,
}: {
  options: EnrollmentOption[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.id === value);
  const displayValue = selectedOption
    ? `${selectedOption.course_code} - ${selectedOption.course_name} (${selectedOption.grade_10?.toFixed(1) || "-"})`
    : "";

  const filteredOptions =
    query === ""
      ? options
      : options.filter((option) => {
          const text =
            `${option.course_code} ${option.course_name}`.toLowerCase();
          return text.includes(query.toLowerCase());
        });

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white focus:border-amber-600 focus:outline-none"
        placeholder="Chọn môn"
        value={isOpen ? query : displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          onChange(null);
        }}
        onClick={() => {
          setIsOpen(true);
          setQuery("");
        }}
      />
      {isOpen && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutral-700 bg-neutral-800 py-1 text-sm shadow-lg">
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-neutral-400">
              Không tìm thấy môn học
            </li>
          ) : (
            filteredOptions.map((option) => (
              <li
                key={option.id}
                className="cursor-pointer px-3 py-2 text-neutral-200 hover:bg-neutral-700 hover:text-white"
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                {option.course_code} - {option.course_name}{" "}
                <span className="text-neutral-500 ml-1">
                  ({option.grade_10?.toFixed(1) || "-"})
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function normalizeGpaOverview(raw: unknown): GpaOverview {
  const value = (raw ?? {}) as any;
  const officialGpa =
    value.daa_dtbctl_10 != null ? value.daa_dtbctl_10 : value.gpa_10;
  const officialCredits =
    value.daa_earned_credits != null
      ? value.daa_earned_credits
      : value.earned_credits;
  return {
    gpa_10: asNumber(officialGpa),
    total_credits: asNumber(officialCredits),
    earned_credits: asNumber(officialCredits),
  };
}

/* ------------------------------------------------------------------ */
/* Section Components                                                 */
/* ------------------------------------------------------------------ */

function GpaSummaryCard({ gpa, label }: { gpa: GpaOverview; label: string }) {
  return (
    <div className="rounded-xl border border-neutral-700/40 bg-neutral-900/60 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-wider text-neutral-400 mb-2">
        {label}
      </p>
      <div className="flex items-baseline gap-6">
        <div>
          <span className="text-2xl font-bold text-white">
            {gpa.gpa_10.toFixed(2)}
          </span>
          <span className="ml-1 text-xs text-neutral-500">/10</span>
        </div>
        <div className="text-sm text-neutral-400">
          {gpa.earned_credits}/{gpa.total_credits} TC
        </div>
      </div>
    </div>
  );
}

function ReverseCalculatorSection({
  defaultRemainingCredits,
  suggestionText,
  currentGpa,
}: {
  defaultRemainingCredits: number;
  suggestionText?: string;
  currentGpa: GpaOverview;
}) {
  const [targetGpa, setTargetGpa] = useState<string>("7.0");
  const [remainingCredits, setRemainingCredits] = useState<string>(
    String(defaultRemainingCredits),
  );
  const [result, setResult] = useState<ReverseResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRemainingCredits(String(defaultRemainingCredits));
  }, [defaultRemainingCredits]);

  const calculate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/gpa-tools/reverse", {
        method: "POST",
        body: JSON.stringify({
          current_gpa_10: currentGpa.gpa_10,
          earned_credits: currentGpa.earned_credits,
          target_gpa_10: Number(targetGpa),
          remaining_credits: Number(remainingCredits),
        }),
      });
      if (res.ok) {
        const raw = (await res.json()) as Partial<ReverseResult>;
        setResult({
          required_avg_10: asNumber(raw.required_avg_10),
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
      <h2 className="text-lg font-semibold text-violet-300 mb-4">
        🎯 Reverse Calculator
      </h2>
      <p className="text-sm text-neutral-300 mb-2">
        GPA hiện tại:{" "}
        <span className="font-semibold text-violet-300">
          {currentGpa.gpa_10.toFixed(2)}
        </span>
      </p>
      <p className="text-xs text-neutral-400 mb-4">
        Tính điểm trung bình các môn còn lại để đạt mục tiêu GPA tốt nghiệp.
      </p>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-xs text-neutral-400 block mb-1">
            GPA mục tiêu (thang 10)
          </label>
          <input
            type="number"
            value={targetGpa}
            onChange={(e) => setTargetGpa(e.target.value)}
            onBlur={(e) => {
              let val = Number(e.target.value);
              if (isNaN(val)) val = 7.0;
              if (val > 10) val = 10;
              if (val < 0) val = 0;
              setTargetGpa(val.toString());
            }}
            className="w-28 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white focus:border-violet-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 block mb-1">
            Tín chỉ còn lại
          </label>
          <input
            type="number"
            value={remainingCredits}
            onChange={(e) => setRemainingCredits(e.target.value)}
            onBlur={(e) => {
              let val = Number(e.target.value);
              if (isNaN(val)) val = defaultRemainingCredits;
              if (val > 200) val = 200;
              if (val < 1) val = 1;
              setRemainingCredits(val.toString());
            }}
            className="w-28 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white focus:border-violet-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {suggestionText && (
        <p className="text-xs text-neutral-400 mt-3 italic">
          💡 {suggestionText}
        </p>
      )}

      {result && !loading && (
        <div className="mt-4 rounded-lg border border-neutral-700/40 bg-neutral-800/40 p-4">
          <p className="text-sm text-neutral-300">
            Điểm TB cần đạt:{" "}
            <span
              className={`text-xl font-bold ${result.achievable ? "text-emerald-300" : "text-red-300"}`}
            >
              {result.required_avg_10.toFixed(2)}
            </span>
            <span className="text-neutral-500 ml-1">/10</span>
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

function RetakeEstimatorSection({
  enrollments,
  currentGpa,
}: {
  enrollments: EnrollmentOption[];
  currentGpa: GpaOverview;
}) {
  const [retakes, setRetakes] = useState<
    { id: number | null; grade: string }[]
  >([{ id: null, grade: "10.0" }]);
  const [result, setResult] = useState<RetakeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const calculate = useCallback(async () => {
    const validRetakes = retakes.filter((r) => r.id !== null);
    if (validRetakes.length === 0) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/gpa-tools/retake", {
        method: "POST",
        body: JSON.stringify({
          retakes: validRetakes.map((r) => ({
            enrollment_id: r.id,
            new_grade_10: Number(r.grade),
          })),
        }),
      });
      if (res.ok) {
        const raw = (await res.json()) as Partial<RetakeResult>;
        setResult({
          old_gpa_10: asNumber(raw.old_gpa_10),
          new_gpa_10: asNumber(raw.new_gpa_10),
          delta_gpa_10: asNumber(raw.delta_gpa_10),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [retakes]);

  useEffect(() => {
    const timer = setTimeout(calculate, 400);
    return () => clearTimeout(timer);
  }, [calculate]);

  // Filter to show only courses that could benefit from retaking (< 8.5)
  const retakeable = enrollments.filter(
    (e) => e.grade_10 !== null && e.grade_10 < 8.5,
  );

  if (retakeable.length === 0) {
    return (
      <section className="rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/20 to-neutral-900/50 p-5">
        <h2 className="text-lg font-semibold text-amber-300 mb-2">
          🔄 Retake Estimator
        </h2>
        <p className="text-sm text-neutral-400">
          Chưa có môn nào phù hợp để tính cải thiện.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-800/30 bg-gradient-to-br from-amber-950/20 to-neutral-900/50 p-5">
      <h2 className="text-lg font-semibold text-amber-300 mb-4">
        🔄 Retake Estimator
      </h2>
      <p className="text-xs text-neutral-400 mb-4">
        Chọn môn điểm thấp → nhập điểm mới dự kiến → xem mức tăng GPA.
      </p>

      {retakes.map((retake, index) => (
        <div key={index} className="flex flex-wrap gap-4 mb-3 items-end">
          <div className="flex-1 min-w-[200px]">
            {index === 0 && (
              <label className="text-xs text-neutral-400 block mb-1">
                Chọn môn
              </label>
            )}
            <CourseAutocomplete
              options={retakeable}
              value={retake.id}
              onChange={(newId) => {
                const newRetakes = [...retakes];
                newRetakes[index].id = newId;
                setRetakes(newRetakes);
              }}
            />
          </div>
          <div>
            {index === 0 && (
              <label className="text-xs text-neutral-400 block mb-1">
                Điểm mới
              </label>
            )}
            <input
              type="number"
              value={retake.grade}
              onChange={(e) => {
                const newRetakes = [...retakes];
                newRetakes[index].grade = e.target.value;
                setRetakes(newRetakes);
              }}
              onBlur={(e) => {
                let val = Number(e.target.value);
                if (isNaN(val)) val = 10.0;
                if (val > 10) val = 10;
                if (val < 0) val = 0;
                const newRetakes = [...retakes];
                newRetakes[index].grade = val.toString();
                setRetakes(newRetakes);
              }}
              className="w-24 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white focus:border-amber-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          {retakes.length > 1 && (
            <button
              onClick={() => {
                const newRetakes = retakes.filter((_, i) => i !== index);
                setRetakes(newRetakes);
              }}
              className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg text-sm transition-colors"
            >
              Xoá
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => setRetakes([...retakes, { id: null, grade: "10.0" }])}
        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mt-1 font-semibold"
      >
        + Thêm môn học
      </button>

      {result && !loading && (
        <div className="mt-4 rounded-lg border border-amber-900/30 bg-amber-950/30 p-4">
          <p className="text-sm text-neutral-300">
            Điểm GPA mới:{" "}
            <span className="text-xl font-bold text-amber-300">
              {(currentGpa.gpa_10 + result.delta_gpa_10).toFixed(2)}
            </span>
          </p>
          <p className="mt-2 text-sm text-neutral-300">
            {result.delta_gpa_10 === 0 ? (
              <>
                Giữ nguyên ở mức{" "}
                <span className="font-semibold text-neutral-200">
                  {currentGpa.gpa_10.toFixed(2)}
                </span>{" "}
              </>
            ) : (
              <>
                Từ{" "}
                <span className="font-semibold text-neutral-200">
                  {currentGpa.gpa_10.toFixed(2)}
                </span>{" "}
                {result.delta_gpa_10 > 0 ? "lên" : "xuống"}{" "}
                <span className="font-semibold text-amber-300">
                  {(currentGpa.gpa_10 + result.delta_gpa_10).toFixed(2)}
                </span>{" "}
                <span className="text-xs text-neutral-500 ml-1">
                  ({result.delta_gpa_10 > 0 ? "tăng " : "giảm "}
                  {Math.abs(result.delta_gpa_10).toFixed(2)})
                </span>
              </>
            )}
          </p>
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
  const [roadmapTotalCredits, setRoadmapTotalCredits] = useState<number>(0);
  const [studentProfile, setStudentProfile] = useState<{
    major_name?: string;
    enrollment_year?: number;
  } | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [gpaRes, roadmapRes, meRes] = await Promise.all([
          apiFetch("/api/v1/tracker/gpa"),
          apiFetch("/api/v1/tracker/roadmap"),
          apiFetch("/api/v1/me"),
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
            total_credits?: number | string;
            nodes: Array<{
              course_id: number | string;
              course_code: string;
              course_name: string;
              credits: number | string;
              grade_10: number | string | null;
            }>;
          };
          setRoadmapTotalCredits(asNumber(data.total_credits, 0));
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
        if (meRes.ok) {
          const rawMe = await meRes.json();
          setStudentProfile({
            major_name: rawMe.major_name,
            enrollment_year: rawMe.enrollment_year,
          });
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
            <p className="text-xs uppercase tracking-[0.2em] text-violet-400">
              GPA Suite
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Bộ công cụ GPA
            </h1>
          </div>
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
            <ReverseCalculatorSection
              defaultRemainingCredits={Math.max(
                0,
                roadmapTotalCredits - gpa.earned_credits,
              )}
              suggestionText={
                roadmapTotalCredits > 0
                  ? `Chương trình đào tạo ${studentProfile?.major_name ? `ngành ${studentProfile.major_name}` : ""} ${studentProfile?.enrollment_year ? `khoá ${studentProfile.enrollment_year}` : ""} cần ít nhất ${roadmapTotalCredits} tín chỉ để tốt nghiệp mà số tín chỉ bạn đã tích luỹ là ${gpa.earned_credits || 0} nên bạn còn ${Math.max(0, roadmapTotalCredits - gpa.earned_credits)} tín chỉ`
                  : undefined
              }
              currentGpa={gpa}
            />
            <RetakeEstimatorSection
              enrollments={enrollments}
              currentGpa={gpa}
            />
          </div>
        )}
      </div>
    </main>
  );
}

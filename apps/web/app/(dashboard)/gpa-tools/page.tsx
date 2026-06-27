"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  BarChart2,
  Target,
  Repeat,
  Lightbulb,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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
        className="w-full bg-white dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 transition-colors outline-none"
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
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-1 text-sm shadow-lg">
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-neutral-500 dark:text-neutral-400">
              Không tìm thấy môn học
            </li>
          ) : (
            filteredOptions.map((option) => (
              <li
                key={option.id}
                className="cursor-pointer px-3 py-2 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100"
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                {option.course_code} - {option.course_name}{" "}
                <span className="text-neutral-400 dark:text-neutral-500 ml-1">
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

function GpaOverviewCard({
  gpa,
  roadmapTotalCredits,
}: {
  gpa: GpaOverview;
  roadmapTotalCredits: number;
}) {
  const gpaPercent = Math.min(100, Math.round((gpa.gpa_10 / 10) * 100));

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-visible flex flex-col justify-between h-full">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none"></div>
      <div>
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 className="w-5 h-5 text-violet-400" strokeWidth={2.5} />
          <h2 className="text-lg font-semibold text-neutral-100">
            Tổng quan GPA
          </h2>
        </div>
        <div className="space-y-6">
          <div>
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              Điểm trung bình chung tích lũy
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-violet-300">
                {gpa.gpa_10.toFixed(2)}
              </span>
              <span className="text-sm text-neutral-500">/ 10</span>
            </div>
          </div>
          <div className="w-full bg-tokyo-sidebar rounded-full h-2 overflow-visible">
            <div
              className="bg-violet-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${gpaPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-neutral-800 flex justify-between items-center">
        <div>
          <p className="text-xs text-neutral-400 mb-1">Số tín chỉ tích lũy</p>
          <p className="text-lg font-semibold text-neutral-100">
            {gpa.earned_credits}{" "}
            <span className="text-sm text-neutral-500 font-normal">
              / {roadmapTotalCredits || "?"} TC
            </span>
          </p>
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
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-amber-400" strokeWidth={2.5} />
          <h2 className="text-lg font-semibold text-neutral-100">
            Reverse Calculator
          </h2>
        </div>
        <p className="text-sm text-neutral-400 mb-6">
          Tính toán điểm trung bình cần đạt cho các tín chỉ còn lại để đạt được
          mục tiêu GPA tốt nghiệp.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">
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
              className="w-full bg-neutral-950/50 border border-neutral-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg px-4 py-3 text-sm text-neutral-100 transition-colors outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">
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
              className="w-full bg-neutral-950/50 border border-neutral-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg px-4 py-3 text-sm text-neutral-100 transition-colors outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {suggestionText && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-900/30 mb-6 flex items-start gap-3 shadow-sm">
            <Lightbulb
              className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <p className="text-sm text-amber-900 dark:text-amber-200/80 italic leading-relaxed">
              {suggestionText}
            </p>
          </div>
        )}
      </div>

      {result && !loading && (
        <div
          className={`rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border shadow-sm ${result.achievable || (!result.achievable && result.required_avg_10 <= 0) ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30"}`}
        >
          <div>
            <p
              className={`font-medium mb-1 ${result.achievable || (!result.achievable && result.required_avg_10 <= 0) ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
            >
              Điểm TB cần đạt cho {remainingCredits} tín chỉ còn lại
            </p>
            <p
              className={`text-sm ${result.achievable || (!result.achievable && result.required_avg_10 <= 0) ? "text-emerald-600 dark:text-emerald-400/80" : "text-red-600 dark:text-red-400/80"}`}
            >
              {result.required_avg_10 <= 0
                ? "✅ Điểm hiện tại của bạn đã đủ để đạt (hoặc vượt) mục tiêu này."
                : result.achievable
                  ? "Mục tiêu khả thi. Cần nỗ lực duy trì phong độ."
                  : "⚠ Không khả thi – mục tiêu GPA quá cao."}
            </p>
          </div>
          <div className="flex items-baseline gap-1 bg-white dark:bg-neutral-950/50 px-6 py-3 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800/50">
            <span
              className={`text-3xl font-bold ${result.achievable || (!result.achievable && result.required_avg_10 <= 0) ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {result.required_avg_10.toFixed(2)}
            </span>
            <span className="text-sm text-neutral-500">/ 10</span>
          </div>
        </div>
      )}
    </div>
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

  const retakeable = enrollments.filter(
    (e) => e.grade_10 !== null && e.grade_10 < 8.5,
  );

  if (retakeable.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Repeat className="w-5 h-5 text-cyan-400" strokeWidth={2.5} />
          <h2 className="text-lg font-semibold text-neutral-100">
            Retake Estimator
          </h2>
        </div>
        <p className="text-sm text-neutral-400">
          Chưa có môn nào phù hợp để tính cải thiện.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-visible flex flex-col">
      <div className="p-6 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Repeat className="w-5 h-5 text-cyan-400" strokeWidth={2.5} />
            <h2 className="text-lg font-semibold text-neutral-100">
              Retake Estimator
            </h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Mô phỏng sự thay đổi của GPA khi học lại và cải thiện điểm các môn
            học cũ.
          </p>
        </div>
        <button
          onClick={() => setRetakes([...retakes, { id: null, grade: "10.0" }])}
          className="px-4 py-2 bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm font-medium rounded-lg hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Thêm môn học
        </button>
      </div>

      <div className="p-6">
        <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-neutral-800 text-xs text-neutral-500 uppercase tracking-wider font-semibold">
          <div className="col-span-8">Môn học (Điểm cũ)</div>
          <div className="col-span-3">Điểm mới dự kiến</div>
        </div>

        <div className="space-y-4 pt-4">
          {retakes.map((retake, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 bg-white dark:bg-neutral-950/30 rounded-lg border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors group"
            >
              <div className="col-span-1 md:col-span-8 flex flex-col">
                <label className="md:hidden text-xs text-neutral-500 mb-1">
                  Môn học
                </label>
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
              <div className="col-span-1 md:col-span-3 flex flex-col">
                <label className="md:hidden text-xs text-neutral-500 mb-1">
                  Điểm mới dự kiến
                </label>
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
                  className="w-full bg-white dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 transition-colors outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="col-span-1 md:col-span-1 flex justify-end">
                {retakes.length > 1 ? (
                  <button
                    onClick={() => {
                      const newRetakes = retakes.filter((_, i) => i !== index);
                      setRetakes(newRetakes);
                    }}
                    className="p-2 text-neutral-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-950/30 flex items-center justify-center"
                    title="Xoá"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-8 h-8"></div>
                )}
              </div>
            </div>
          ))}
        </div>

        {result && !loading && (
          <div className="mt-8 bg-[#8839ef]/10 dark:bg-tokyo-storm border border-cyan-900/30 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-lg text-neutral-400">
                {result.delta_gpa_10 === 0 ? (
                  <>
                    Giữ nguyên ở mức{" "}
                    <span className="text-neutral-100 font-semibold">
                      {currentGpa.gpa_10.toFixed(2)}
                    </span>{" "}
                    (không đổi)
                  </>
                ) : (
                  <>
                    Từ{" "}
                    <span className="text-neutral-100 font-semibold">
                      {currentGpa.gpa_10.toFixed(2)}
                    </span>{" "}
                    {result.delta_gpa_10 > 0 ? "lên" : "xuống"}{" "}
                    <span className="text-tokyo-cyan font-semibold">
                      {(currentGpa.gpa_10 + result.delta_gpa_10).toFixed(2)}
                    </span>{" "}
                  </>
                )}
              </p>
            </div>
            <div className=" flex items-baseline gap-1  px-6 py-3  ">
              <span
                className={`text-3xl font-bold ${result.delta_gpa_10 >= 0 ? "text-cyan-500" : "text-red-400"}`}
              >
                {result.delta_gpa_10 > 0 ? "+" : "-"}
                {result.delta_gpa_10.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CourseImpactRanking({
  enrollments,
  currentGpa,
}: {
  enrollments: EnrollmentOption[];
  currentGpa: GpaOverview;
}) {
  const [showAll, setShowAll] = useState(false);

  const ranked = enrollments
    .filter((e) => e.grade_10 !== null)
    .map((e) => {
      const impact = (currentGpa.gpa_10 - e.grade_10!) * e.credits;
      return { ...e, impact };
    })
    .filter((e) => e.impact > 0)
    .sort((a, b) => b.impact - a.impact);

  if (ranked.length === 0) return null;

  const maxImpact = Math.max(...ranked.map((r) => Math.abs(r.impact)), 1);
  const visible = showAll ? ranked : ranked.slice(0, 5);

  function getImpactColor(grade: number): string {
    if (grade >= 8.0) return "bg-tokyo-green";
    if (grade >= 6.5) return "bg-tokyo-yellow";
    if (grade >= 5.0) return "bg-tokyo-orange";
    return "bg-tokyo-red";
  }

  function getGradeTextColor(grade: number): string {
    if (grade >= 8.0) return "text-tokyo-green";
    if (grade >= 6.5) return "text-tokyo-yellow";
    if (grade >= 5.0) return "text-tokyo-orange";
    return "text-tokyo-red";
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-visible">
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle
            className="w-5 h-5 text-tokyo-orange"
            strokeWidth={2.5}
          />
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
            Nên cải thiện môn nào?
          </h2>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Xếp hạng theo mức độ kéo tụt GPA. Môn ở trên cùng nên được ưu tiên học
          cải thiện trước.
        </p>
      </div>

      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
        {visible.map((course, i) => {
          const gap = currentGpa.gpa_10 - course.grade_10!;
          const isBelow = gap > 0;

          return (
            <div
              key={course.id}
              className="group relative flex items-center gap-4 px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
            >
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 w-6 text-right shrink-0">
                {i + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate">
                    {course.course_name}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
                    {course.course_code} · {course.credits} TC
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getImpactColor(course.grade_10!)}`}
                    style={{
                      width: `${Math.max(4, (Math.abs(course.impact) / maxImpact) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`text-sm font-bold ${getGradeTextColor(course.grade_10!)}`}
                >
                  {course.grade_10!.toFixed(1)}
                </span>
              </div>

              {/* Tooltip */}
              <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-72">
                <div className="bg-white dark:bg-tokyo-panel text-tokyo-fg text-xs rounded-lg px-4 py-3 shadow-xl border border-neutral-200 dark:border-tokyo-border leading-relaxed">
                  {isBelow ? (
                    <>
                      Điểm{" "}
                      <span className="font-bold text-tokyo-red">
                        {course.grade_10!.toFixed(1)}
                      </span>{" "}
                      thấp hơn GPA tích lũy (
                      <span className="font-bold text-tokyo-cyan">
                        {currentGpa.gpa_10.toFixed(2)}
                      </span>
                      ) tới{" "}
                      <span className="font-bold text-tokyo-orange">
                        {gap.toFixed(2)}
                      </span>{" "}
                      điểm. Với{" "}
                      <span className="font-bold">
                        {course.credits} tín chỉ
                      </span>
                      {gap >= 2.0
                        ? ", môn này đang kéo tụt GPA rất nhiều."
                        : gap >= 1.0
                          ? ", môn này đang kéo tụt GPA đáng kể."
                          : gap >= 0.5
                            ? ", môn này đang kéo tụt GPA kha khá."
                            : ", cải thiện môn này sẽ giúp tăng nhẹ GPA."}
                    </>
                  ) : (
                    <>
                      Điểm{" "}
                      <span className="font-bold text-tokyo-green">
                        {course.grade_10!.toFixed(1)}
                      </span>{" "}
                      đã cao hơn GPA tích lũy (
                      <span className="font-bold text-tokyo-cyan">
                        {currentGpa.gpa_10.toFixed(2)}
                      </span>
                      ). Môn này đang{" "}
                      <span className="font-bold text-tokyo-green">
                        nâng GPA
                      </span>{" "}
                      của bạn lên.
                    </>
                  )}
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-white dark:border-t-tokyo-panel" />
              </div>
            </div>
          );
        })}
      </div>

      {ranked.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-6 py-3 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors flex items-center justify-center gap-1.5 border-t border-neutral-200 dark:border-neutral-800/60"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" /> Thu gọn
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" /> Xem tất cả {ranked.length} môn
            </>
          )}
        </button>
      )}
    </div>
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
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-2 mb-8">
          <p className="text-base text-neutral-400 max-w-2xl mt-1">
            Tính toán, mô phỏng và lập chiến lược cải thiện điểm số học tập của
            bạn với độ chính xác cao.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-800/40 bg-[#f7768e]/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && gpa && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 w-full lg:w-[40%] xl:w-[35%] space-y-6">
              <GpaOverviewCard
                gpa={gpa}
                roadmapTotalCredits={roadmapTotalCredits}
              />
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
            </div>
            <div className="flex-1 w-full lg:w-[60%] xl:w-[65%] space-y-6">
              <RetakeEstimatorSection
                enrollments={enrollments}
                currentGpa={gpa}
              />
              <CourseImpactRanking enrollments={enrollments} currentGpa={gpa} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

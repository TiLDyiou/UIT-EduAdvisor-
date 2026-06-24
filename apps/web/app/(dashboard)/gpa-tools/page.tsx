"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { BarChart2, Target, Repeat, Lightbulb, Plus, Trash2 } from "lucide-react";

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
        className="w-full bg-neutral-950/50 border border-neutral-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg px-4 py-2.5 text-sm text-white transition-colors outline-none"
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

function GpaOverviewCard({
  gpa,
  roadmapTotalCredits,
}: {
  gpa: GpaOverview;
  roadmapTotalCredits: number;
}) {
  const gpaPercent = Math.min(100, Math.round((gpa.gpa_10 / 10) * 100));

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden flex flex-col justify-between h-full">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none"></div>
      <div>
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 className="w-5 h-5 text-violet-400" strokeWidth={2.5} />
          <h2 className="text-lg font-semibold text-white">Tổng quan GPA</h2>
        </div>
        <div className="space-y-6">
          <div>
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">
              GPA Tích luỹ (Thang 10)
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-violet-300">
                {gpa.gpa_10.toFixed(2)}
              </span>
              <span className="text-sm text-neutral-500">/ 10</span>
            </div>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-violet-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${gpaPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-neutral-800 flex justify-between items-center">
        <div>
          <p className="text-xs text-neutral-400 mb-1">Tín chỉ tích luỹ</p>
          <p className="text-lg font-semibold text-white">
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
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-amber-400" strokeWidth={2.5} />
          <h2 className="text-lg font-semibold text-white">
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
              className="w-full bg-neutral-950/50 border border-neutral-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg px-4 py-3 text-sm text-white transition-colors outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
              className="w-full bg-neutral-950/50 border border-neutral-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg px-4 py-3 text-sm text-white transition-colors outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {suggestionText && (
          <div className="p-4 bg-neutral-800/30 rounded-lg border border-neutral-700/50 mb-6 flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-sm text-neutral-400 italic leading-relaxed">
              {suggestionText}
            </p>
          </div>
        )}
      </div>

      {result && !loading && (
        <div
          className={`rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border ${result.achievable || (!result.achievable && result.required_avg_10 <= 0) ? "bg-emerald-950/20 border-emerald-900/30" : "bg-red-950/20 border-red-900/30"}`}
        >
          <div>
            <p
              className={`font-medium mb-1 ${result.achievable || (!result.achievable && result.required_avg_10 <= 0) ? "text-emerald-300" : "text-red-300"}`}
            >
              Điểm TB cần đạt cho {remainingCredits} tín chỉ còn lại
            </p>
            <p
              className={`text-sm ${result.achievable || (!result.achievable && result.required_avg_10 <= 0) ? "text-emerald-400/80" : "text-red-400/80"}`}
            >
              {result.required_avg_10 <= 0
                ? "✅ Điểm hiện tại của bạn đã đủ để đạt (hoặc vượt) mục tiêu này."
                : result.achievable
                  ? "Mục tiêu khả thi. Cần nỗ lực duy trì phong độ."
                  : "⚠ Không khả thi – mục tiêu GPA quá cao."}
            </p>
          </div>
          <div className="flex items-baseline gap-1 bg-neutral-950/50 px-6 py-3 rounded-lg shadow-sm border border-neutral-800/50">
            <span
              className={`text-3xl font-bold ${result.achievable || (!result.achievable && result.required_avg_10 <= 0) ? "text-emerald-400" : "text-red-400"}`}
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
          <h2 className="text-lg font-semibold text-white">Retake Estimator</h2>
        </div>
        <p className="text-sm text-neutral-400">
          Chưa có môn nào phù hợp để tính cải thiện.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Repeat className="w-5 h-5 text-cyan-400" strokeWidth={2.5} />
            <h2 className="text-lg font-semibold text-white">Retake Estimator</h2>
          </div>
          <p className="text-sm text-neutral-400">Mô phỏng sự thay đổi của GPA khi học lại và cải thiện điểm các môn học cũ.</p>
        </div>
        <button
          onClick={() => setRetakes([...retakes, { id: null, grade: "10.0" }])}
          className="px-4 py-2 bg-neutral-800 border border-neutral-700 text-white text-sm font-medium rounded-lg hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Thêm môn học
        </button>
      </div>

      <div className="p-6">
        <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-neutral-800 text-xs text-neutral-500 uppercase tracking-wider font-semibold">
          <div className="col-span-6">Môn học (Điểm cũ)</div>
          <div className="col-span-4">Điểm mới dự kiến</div>
          <div className="col-span-2 text-right">Thao tác</div>
        </div>

        <div className="space-y-4 pt-4">
          {retakes.map((retake, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 bg-neutral-950/30 rounded-lg border border-neutral-800/80 hover:border-neutral-700 transition-colors group">
              <div className="col-span-1 md:col-span-6 flex flex-col">
                <label className="md:hidden text-xs text-neutral-500 mb-1">Môn học</label>
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
              <div className="col-span-1 md:col-span-4 flex flex-col">
                <label className="md:hidden text-xs text-neutral-500 mb-1">Điểm mới dự kiến</label>
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
                  className="w-full bg-neutral-950/50 border border-neutral-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg px-4 py-2.5 text-sm text-white transition-colors outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="col-span-1 md:col-span-2 flex justify-end">
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
          <div className="mt-8 bg-cyan-950/20 border border-cyan-900/30 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-white mb-1">Dự báo thay đổi GPA</p>
              <p className="text-sm text-neutral-400">
                {result.delta_gpa_10 === 0 ? (
                  <>Giữ nguyên ở mức <span className="text-white font-semibold">{currentGpa.gpa_10.toFixed(2)}</span> (không đổi)</>
                ) : (
                  <>Từ <span className="text-white font-semibold">{currentGpa.gpa_10.toFixed(2)}</span> {result.delta_gpa_10 > 0 ? "lên" : "xuống"} <span className="text-cyan-400 font-semibold">{(currentGpa.gpa_10 + result.delta_gpa_10).toFixed(2)}</span> (tăng/giảm <span className={`${result.delta_gpa_10 > 0 ? 'text-cyan-400' : 'text-red-400'}`}>{result.delta_gpa_10 > 0 ? "+" : ""}{result.delta_gpa_10.toFixed(2)}</span>)</>
                )}
              </p>
            </div>
            <div className="flex items-baseline gap-1 bg-neutral-950/50 px-6 py-3 rounded-lg shadow-sm border border-neutral-800/50">
              <span className={`text-3xl font-bold ${result.delta_gpa_10 >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                {result.delta_gpa_10 > 0 ? "+" : ""}{result.delta_gpa_10.toFixed(2)}
              </span>
              <span className="text-sm text-neutral-500">tăng/giảm</span>
            </div>
          </div>
        )}
      </div>
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
          <div className="rounded-lg border border-red-800/40 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && gpa && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <GpaOverviewCard
                gpa={gpa}
                roadmapTotalCredits={roadmapTotalCredits}
              />
            </div>
            <div className="lg:col-span-8">
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
            <div className="lg:col-span-12">
              <RetakeEstimatorSection
                enrollments={enrollments}
                currentGpa={gpa}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

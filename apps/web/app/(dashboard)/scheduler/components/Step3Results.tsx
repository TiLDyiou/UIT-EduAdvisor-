"use client";

import React, { useState, useRef, useEffect } from "react";
import { ScheduleSolution, Section, schedulerService } from "@/lib/scheduler";
import {
  Calendar,
  Download,
  AlertCircle,
  MapPin,
  User,
  Edit2,
  CalendarDays,
  CheckCircle2,
  Image as ImageIcon,
  Sun,
  Moon,
} from "lucide-react";

interface Props {
  solutions: ScheduleSolution[];
  sections: Section[];
  warnings?: string[];
  onBack: () => void;
}

const DAYS = [
  { label: "Thứ 2", value: 2 },
  { label: "Thứ 3", value: 3 },
  { label: "Thứ 4", value: 4 },
  { label: "Thứ 5", value: 5 },
  { label: "Thứ 6", value: 6 },
  { label: "Thứ 7", value: 7 },
  { label: "CN", value: 8 },
];

const PERIODS = Array.from({ length: 10 }, (_, i) => i + 1);

const getPeriodTime = (p: number) => {
  switch (p) {
    case 1:
      return "07:30 - 08:15";
    case 2:
      return "08:15 - 09:00";
    case 3:
      return "09:00 - 09:45";
    case 4:
      return "09:45 - 10:30";
    case 5:
      return "10:30 - 11:15";
    case 6:
      return "13:00 - 13:45";
    case 7:
      return "13:45 - 14:30";
    case 8:
      return "14:30 - 15:15";
    case 9:
      return "15:15 - 16:00";
    case 10:
      return "16:00 - 16:45";
    default:
      return "";
  }
};

const cleanValue = (val: string | null | undefined): string => {
  if (!val) return "";
  const trimmed = val.trim();
  return trimmed === "*" ? "" : trimmed;
};

const getBaseCourseCode = (code: string): string => {
  return code.replace(/\.[12]$/, "").trim();
};

const COLOR_PALETTES = [
  {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    bar: "bg-indigo-500",
    text: "text-indigo-400",
    textLight: "text-indigo-300",
    pillBg: "bg-indigo-500/20",
    borderLight: "border-indigo-500/10",
  },
  {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    textLight: "text-emerald-300",
    pillBg: "bg-emerald-500/20",
    borderLight: "border-emerald-500/10",
  },
  {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    bar: "bg-rose-500",
    text: "text-rose-400",
    textLight: "text-rose-300",
    pillBg: "bg-rose-500/20",
    borderLight: "border-rose-500/10",
  },
  {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    bar: "bg-amber-500",
    text: "text-amber-400",
    textLight: "text-amber-300",
    pillBg: "bg-amber-500/20",
    borderLight: "border-amber-500/10",
  },
  {
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    bar: "bg-sky-500",
    text: "text-sky-400",
    textLight: "text-sky-300",
    pillBg: "bg-sky-500/20",
    borderLight: "border-sky-500/10",
  },
  {
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    bar: "bg-violet-500",
    text: "text-violet-400",
    textLight: "text-violet-300",
    pillBg: "bg-violet-500/20",
    borderLight: "border-violet-500/10",
  },
  {
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    bar: "bg-teal-500",
    text: "text-teal-400",
    textLight: "text-teal-300",
    pillBg: "bg-teal-500/20",
    borderLight: "border-teal-500/10",
  },
  {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    bar: "bg-orange-500",
    text: "text-orange-400",
    textLight: "text-orange-300",
    pillBg: "bg-orange-500/20",
    borderLight: "border-orange-500/10",
  },
];

export default function Step3Results({
  solutions,
  sections,
  warnings = [],
  onBack,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [exportTheme, setExportTheme] = useState<"dark" | "light">("dark");
  const gridRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark");
      setExportTheme(isDark ? "dark" : "light");

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === "class") {
            const isDarkNow =
              document.documentElement.classList.contains("dark");
            setExportTheme(isDarkNow ? "dark" : "light");
          }
        }
      });
      observer.observe(document.documentElement, { attributes: true });
      return () => observer.disconnect();
    }
  }, []);

  const selectedSolution = solutions[selectedIndex];

  const courseColorMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    if (!selectedSolution) return map;

    const uniqueBases: string[] = [];
    selectedSolution.sections.forEach((s) => {
      const base = getBaseCourseCode(s.course_code);
      if (!uniqueBases.includes(base)) {
        uniqueBases.push(base);
      }
    });

    uniqueBases.forEach((base, index) => {
      map[base] = index % COLOR_PALETTES.length;
    });

    return map;
  }, [selectedSolution]);

  const handleExport = async () => {
    if (!selectedSolution) return;
    setExporting(true);
    try {
      const solutionSections = selectedSolution.sections
        .map(
          (ss) =>
            sections.find(
              (s) =>
                s.course_code === ss.course_code &&
                s.section_code === ss.section_code,
            )!,
        )
        .filter(Boolean);

      await schedulerService.exportIcs({
        sections: solutionSections,
        term_start: new Date().toISOString().split("T")[0],
        term_weeks: 15,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportImage = async () => {
    if (!gridRef.current) return;
    setExportingImage(true);
    try {
      const { toPng } = await import("html-to-image");
      const isLight = exportTheme === "light";
      const image = await toPng(gridRef.current, {
        backgroundColor: isLight ? "#ffffff" : "#171717",
        pixelRatio: 3,
        style: {
          // Reset style override if needed
        },
      });
      const link = document.createElement("a");
      link.href = image;
      link.download = `TKB_UIT_EduAdvisor.png`;
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      setExportingImage(false);
    }
  };

  if (solutions.length === 0) {
    return (
      <div className="py-24 border border-dashed border-red-500/30 bg-red-500/5 rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-neutral-100">
            Không tìm thấy phương án phù hợp
          </h3>
          <p className="text-neutral-400 max-w-md mx-auto text-sm leading-relaxed">
            Hệ thống không thể xếp được lịch thỏa mãn các điều kiện của bạn.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-8 py-3.5 bg-white text-black hover:bg-neutral-200 rounded-xl font-medium flex items-center gap-2 mt-4"
        >
          <Edit2 className="w-4 h-4" /> Quay Lại Chỉnh Sửa
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-in fade-in duration-700">
      {/* Global Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-500 mb-1">
              Lưu ý về lịch bận cá nhân
            </h3>
            <ul className="list-disc list-inside text-sm text-yellow-500/90 space-y-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* CSS Ghi đè xuất ảnh nền trắng */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .light-theme-export {
          background-color: #ffffff !important;
          color: #171717 !important;
        }
        .light-theme-export th {
          background-color: #f3f4f6 !important;
          color: #374151 !important;
          border-color: #e5e7eb !important;
        }
        .light-theme-export td {
          background-color: #ffffff !important;
          border-color: #e5e7eb !important;
        }
        .light-theme-export td.bg-neutral-950 {
          background-color: #f9fafb !important;
        }
        .light-theme-export .text-white {
          color: #111827 !important;
        }
        .light-theme-export .text-neutral-300 {
          color: #374151 !important;
        }
        .light-theme-export .text-neutral-500 {
          color: #6b7280 !important;
        }
        
        .light-theme-export .bg-indigo-500\\/10 { background-color: rgba(99, 102, 241, 0.15) !important; border-color: rgba(99, 102, 241, 0.4) !important; }
        .light-theme-export .bg-emerald-500\\/10 { background-color: rgba(16, 185, 129, 0.15) !important; border-color: rgba(16, 185, 129, 0.4) !important; }
        .light-theme-export .bg-rose-500\\/10 { background-color: rgba(244, 63, 94, 0.15) !important; border-color: rgba(244, 63, 94, 0.4) !important; }
        .light-theme-export .bg-amber-500\\/10 { background-color: rgba(245, 158, 11, 0.15) !important; border-color: rgba(245, 158, 11, 0.4) !important; }
        .light-theme-export .bg-sky-500\\/10 { background-color: rgba(14, 165, 233, 0.15) !important; border-color: rgba(14, 165, 233, 0.4) !important; }
        .light-theme-export .bg-violet-500\\/10 { background-color: rgba(139, 92, 246, 0.15) !important; border-color: rgba(139, 92, 246, 0.4) !important; }
        .light-theme-export .bg-teal-500\\/10 { background-color: rgba(20, 184, 166, 0.15) !important; border-color: rgba(20, 184, 166, 0.4) !important; }
        .light-theme-export .bg-orange-500\\/10 { background-color: rgba(249, 115, 22, 0.15) !important; border-color: rgba(249, 115, 22, 0.4) !important; }

        .light-theme-export .text-indigo-400 { color: #4f46e5 !important; }
        .light-theme-export .text-emerald-400 { color: #047857 !important; }
        .light-theme-export .text-rose-400 { color: #be123c !important; }
        .light-theme-export .text-amber-400 { color: #b45309 !important; }
        .light-theme-export .text-sky-400 { color: #0369a1 !important; }
        .light-theme-export .text-violet-400 { color: #6d28d9 !important; }
        .light-theme-export .text-teal-400 { color: #0f766e !important; }
        .light-theme-export .text-orange-400 { color: #c2410c !important; }

        .light-theme-export .text-indigo-300 { color: #4338ca !important; }
        .light-theme-export .text-emerald-300 { color: #065f46 !important; }
        .light-theme-export .text-rose-300 { color: #9f1239 !important; }
        .light-theme-export .text-amber-300 { color: #92400e !important; }
        .light-theme-export .text-sky-300 { color: #075985 !important; }
        .light-theme-export .text-violet-300 { color: #5b21b6 !important; }
        .light-theme-export .text-teal-300 { color: #115e59 !important; }
        .light-theme-export .text-orange-300 { color: #9a3412 !important; }

        .light-theme-export .bg-indigo-500\\/20 { background-color: rgba(99, 102, 241, 0.25) !important; }
        .light-theme-export .bg-emerald-500\\/20 { background-color: rgba(16, 185, 129, 0.25) !important; }
        .light-theme-export .bg-rose-500\\/20 { background-color: rgba(244, 63, 94, 0.25) !important; }
        .light-theme-export .bg-amber-500\\/20 { background-color: rgba(245, 158, 11, 0.25) !important; }
        .light-theme-export .bg-sky-500\\/20 { background-color: rgba(14, 165, 233, 0.25) !important; }
        .light-theme-export .bg-violet-500\\/20 { background-color: rgba(139, 92, 246, 0.25) !important; }
        .light-theme-export .bg-teal-500\\/20 { background-color: rgba(20, 184, 166, 0.25) !important; }
        .light-theme-export .bg-orange-500\\/20 { background-color: rgba(249, 115, 22, 0.25) !important; }

        html body .dark-theme-export {
          background-color: #262626 !important;
          color: #f3f4f6 !important;
        }
        html body .dark-theme-export th {
          background-color: #171717 !important;
          color: #9ca3af !important;
          border-color: #404040 !important;
        }
        html body .dark-theme-export td {
          background-color: #262626 !important;
          border-color: #404040 !important;
        }
        html body .dark-theme-export td.bg-neutral-950,
        html body .dark-theme-export .bg-neutral-950 {
          background-color: #0a0a0a !important;
        }
        html body .dark-theme-export td.bg-neutral-900,
        html body .dark-theme-export .bg-neutral-900 {
          background-color: #171717 !important;
        }
        html body .dark-theme-export .text-white { color: #ffffff !important; }
        html body .dark-theme-export .text-neutral-300 { color: #d1d5db !important; }
        html body .dark-theme-export .text-neutral-400 { color: #9ca3af !important; }
        html body .dark-theme-export .text-neutral-500 { color: #6b7280 !important; }

        html body .dark-theme-export .text-indigo-400 { color: #818cf8 !important; }
        html body .dark-theme-export .text-emerald-400 { color: #34d399 !important; }
        html body .dark-theme-export .text-rose-400 { color: #fb7185 !important; }
        html body .dark-theme-export .text-amber-400 { color: #fbbf24 !important; }
        html body .dark-theme-export .text-sky-400 { color: #38bdf8 !important; }
        html body .dark-theme-export .text-violet-400 { color: #a78bfa !important; }
        html body .dark-theme-export .text-teal-400 { color: #2dd4bf !important; }
        html body .dark-theme-export .text-orange-400 { color: #fb923c !important; }

        html body .dark-theme-export .text-indigo-300 { color: #a5b4fc !important; }
        html body .dark-theme-export .text-emerald-300 { color: #6ee7b7 !important; }
        html body .dark-theme-export .text-rose-300 { color: #fda4af !important; }
        html body .dark-theme-export .text-amber-300 { color: #fcd34d !important; }
        html body .dark-theme-export .text-sky-300 { color: #7dd3fc !important; }
        html body .dark-theme-export .text-violet-300 { color: #c4b5fd !important; }
        html body .dark-theme-export .text-teal-300 { color: #5eead4 !important; }
        html body .dark-theme-export .text-orange-300 { color: #fdba74 !important; }
      `,
        }}
      />

      {/* Cảnh báo môn học */}
      {selectedSolution?.missing_courses &&
        selectedSolution.missing_courses.length > 0 && (
          <div className="flex flex-col gap-2 animate-in fade-in duration-300">
            {selectedSolution.missing_courses.map((msg, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-lg font-medium leading-relaxed max-w-xl"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>{msg}</span>
              </div>
            ))}
          </div>
        )}

      {/* Thanh điều khiển chọn phương án và xuất dữ liệu (Luôn thu gọn) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-neutral-900 border border-neutral-800 rounded-2xl p-3 gap-4">
        <div className="flex flex-row items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex flex-wrap gap-2">
            {solutions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative overflow-hidden text-sm font-semibold rounded-xl border px-4 py-1.5 transition-all duration-300 ${
                  selectedIndex === idx
                    ? "bg-tokyo-cyan text-white dark:text-tokyo-comment border-transparent shadow-[0_4px_20px_-4px_rgba(14,165,233,0.4)] hover:shadow-[0_4px_20px_-2px_rgba(14,165,233,0.5)] scale-[1.02]"
                    : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 hover:shadow-sm"
                }`}
              >
                {selectedIndex === idx && (
                  <span className="absolute inset-0 w-full h-full bg-white/20 blur-[8px] animate-pulse rounded-xl pointer-events-none" />
                )}
                <span className="relative z-10">#{idx + 1}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-0">
          <button
            onClick={() =>
              setExportTheme((prev) => (prev === "dark" ? "light" : "dark"))
            }
            className="border border-neutral-700 text-neutral-300 hover:bg-neutral-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 w-9 h-9"
            title="Đổi giao diện TKB (ảnh hưởng đến lúc xuất ảnh)"
          >
            {exportTheme === "dark" ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleExportImage}
            disabled={exportingImage}
            className="bg-indigo-600 hover:bg-indigo-500 text-tokyo-storm rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 w-9 h-9"
            title="Xuất Ảnh (.png)"
          >
            {exportingImage ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-emerald-600 hover:bg-emerald-500 text-tokyo-storm rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 w-9 h-9"
            title="Xuất Lịch (.ics)"
          >
            {exporting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Khu vực hiển thị Bảng Thời khóa biểu */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <div className="p-6 overflow-x-auto custom-scrollbar">
          {(() => {
            type CellData = null | "xx" | (typeof selectedSolution.sections)[0];
            const matrix: CellData[][] = Array.from({ length: 10 }, () =>
              Array(7).fill(null),
            );

            selectedSolution.sections.forEach((s) => {
              const startPeriod = s.periods[0];
              const dayIndex = s.day_of_week - 2;
              matrix[startPeriod - 1][dayIndex] = s;
              for (let i = 1; i < s.periods.length; i++) {
                matrix[startPeriod - 1 + i][dayIndex] = "xx";
              }
            });

            return (
              <table
                ref={gridRef}
                className={`w-full min-w-[800px] border-collapse bg-neutral-800 border-hidden rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(38,38,38,1)] table-fixed transition-colors duration-200 ${
                  exportTheme === "light"
                    ? "light-theme-export"
                    : "dark-theme-export"
                }`}
              >
                <thead>
                  <tr className="h-[48px]">
                    <th className="border border-neutral-800/50 bg-neutral-900 p-2 w-[80px]"></th>
                    {DAYS.map((d) => (
                      <th
                        key={`header-${d.value}`}
                        className="border border-neutral-800/50 bg-neutral-900 p-3 text-center text-sm font-medium text-neutral-400"
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p, pIndex) => (
                    <tr key={`period-${p}`} className="h-[72px]">
                      <td className="border border-neutral-800/50 bg-neutral-900 text-center p-2 align-middle w-[80px]">
                        <div className="flex flex-col items-center justify-center font-medium text-neutral-500">
                          <span className="text-xs">Tiết {p}</span>
                          <span className="text-[10px] opacity-60 mt-0.5">
                            {getPeriodTime(p)}
                          </span>
                        </div>
                      </td>
                      {DAYS.map((d, dIndex) => {
                        const cell = matrix[pIndex][dIndex];
                        if (cell === "xx") return null;

                        if (cell === null) {
                          return (
                            <td
                              key={`empty-${d.value}-${p}`}
                              className="border border-neutral-800/50 bg-neutral-950"
                            ></td>
                          );
                        }

                        const rowSpan = cell.periods.length;
                        const baseCode = getBaseCourseCode(cell.course_code);
                        const colorIdx = courseColorMap[baseCode] ?? 0;
                        const palette = COLOR_PALETTES[colorIdx];

                        return (
                          <td
                            key={`section-${cell.course_code}-${cell.section_code}`}
                            rowSpan={rowSpan}
                            className="border border-neutral-800/50 p-[3px] align-top bg-neutral-950"
                          >
                            <div
                              className={`w-full ${palette.bg} border ${palette.border} rounded-lg overflow-hidden relative flex flex-col justify-start`}
                              style={{ height: `${rowSpan * 72 - 6}px` }}
                            >
                              <div
                                className={`absolute left-0 top-0 bottom-0 w-1 ${palette.bar}`}
                              />

                              {/* Hiển thị các thông tin liền kề nhau xếp từ trên xuống */}
                              <div className="p-2 flex flex-col ml-1 justify-start gap-2 overflow-hidden">
                                <div className="space-y-1">
                                  <div className="text-xs font-semibold text-white leading-tight break-words">
                                    {cell.course_name}
                                    {/\.[12]$/.test(cell.section_code) && (
                                      <span
                                        className={`font-medium ml-1 whitespace-nowrap ${palette.text}`}
                                      >
                                        (TH)
                                      </span>
                                    )}
                                  </div>

                                  {/* Mã môn học */}
                                  <div className="flex">
                                    <span
                                      className={`text-[10px] ${palette.textLight} font-medium ${palette.pillBg} px-1.5 py-0.5 rounded inline-flex items-center justify-center leading-none`}
                                    >
                                      {cell.section_code}
                                    </span>
                                  </div>
                                </div>

                                {/* Thông tin phòng và giảng viên hiển thị to hơn 1 tí (text-[11px]) */}
                                <div
                                  className={`space-y-1.5 pt-1.5 border-t ${palette.borderLight}`}
                                >
                                  <div className="text-[11px] text-neutral-300 flex items-start min-w-0">
                                    <MapPin className="w-3 h-3 text-neutral-400 shrink-0 mr-1 mt-0.5" />
                                    <span className="break-words leading-tight">
                                      {cleanValue(cell.room)}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-neutral-300 flex items-start min-w-0">
                                    <User className="w-3 h-3 text-neutral-400 shrink-0 mr-1 mt-0.5" />
                                    <div className="break-words leading-tight space-y-0.5">
                                      {(() => {
                                        const cleaned = cleanValue(
                                          cell.instructor_name,
                                        );
                                        if (!cleaned) return "";
                                        return cleaned
                                          .split(/[\n\r,;/]/)
                                          .map((n) => n.trim())
                                          .filter(Boolean)
                                          .map((n, idx) => (
                                            <span key={idx} className="block">
                                              {n}
                                            </span>
                                          ));
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

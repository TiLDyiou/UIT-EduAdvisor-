"use client";

import React, { useState, useRef } from "react";
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

export default function Step3Results({ solutions, sections, onBack }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [exportTheme, setExportTheme] = useState<"dark" | "light">("dark");
  const gridRef = useRef<HTMLTableElement>(null);

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
      <div className="py-24 border border-dashed border-red-500/30 bg-red-500/5 rounded-2xl flex flex-col items-center justify-center gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-white">
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
    <div className="space-y-8 animate-in fade-in duration-700">
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
      `,
        }}
      />

      {/* Thanh điều khiển chọn phương án và xuất dữ liệu */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-neutral-900 border border-neutral-800 p-6 rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">
              Kết quả xếp lịch tối ưu
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {solutions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                  selectedIndex === idx
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20"
                    : "bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
                }`}
              >
                Phương án {idx + 1}
              </button>
            ))}
          </div>
          {selectedSolution?.missing_courses &&
            selectedSolution.missing_courses.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 animate-in fade-in duration-300">
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
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-neutral-700 text-neutral-300 hover:bg-neutral-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" /> Đổi lịch rảnh/bận
          </button>

          {/* Chọn nền hiển thị và xuất ảnh */}
          <div className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded-lg p-1">
            <button
              onClick={() => setExportTheme("dark")}
              type="button"
              title="Giao diện nền tối"
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                exportTheme === "dark"
                  ? "bg-neutral-700 text-amber-400 shadow-sm border border-neutral-600"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
              }`}
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setExportTheme("light")}
              type="button"
              title="Giao diện nền sáng"
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                exportTheme === "light"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleExportImage}
            disabled={exportingImage}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {exportingImage ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            Xuất Ảnh (.png)
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {exporting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Xuất Lịch (.ics)
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
                  exportTheme === "light" ? "light-theme-export" : ""
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

      {/* Danh sách thẻ chi tiết môn học phía dưới */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {selectedSolution.sections.map((s) => {
          const baseCode = getBaseCourseCode(s.course_code);
          const colorIdx = courseColorMap[baseCode] ?? 0;
          const palette = COLOR_PALETTES[colorIdx];

          return (
            <div
              key={`${s.course_code}-${s.section_code}`}
              className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors shadow-sm relative overflow-hidden pl-6"
            >
              {/* Thanh màu tương đồng bên trái thẻ */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${palette.bar}`}
              />

              <div className="flex items-start justify-between mb-4">
                <h4 className="text-base font-semibold text-white leading-tight pr-4">
                  {s.course_name}
                  {/\.[12]$/.test(s.section_code) && (
                    <span
                      className={`font-medium ml-1.5 whitespace-nowrap ${palette.text}`}
                    >
                      (TH)
                    </span>
                  )}
                </h4>
                <span
                  className={`text-xs font-medium px-2.5 py-1 ${palette.pillBg} ${palette.text} rounded-md shrink-0 border ${palette.borderLight}`}
                >
                  {s.section_code}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800">
                <div className="space-y-1.5">
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Phòng học
                  </p>
                  <p className="text-sm font-medium text-neutral-200">
                    {cleanValue(s.room)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Giảng viên
                  </p>
                  <div className="text-sm font-medium text-neutral-200 break-words space-y-1">
                    {(() => {
                      const cleaned = cleanValue(s.instructor_name);
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
                <div className="space-y-1.5 col-span-2">
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Lịch học
                  </p>
                  <p className={`text-sm font-medium ${palette.textLight}`}>
                    Thứ {s.day_of_week}, Tiết {s.periods[0]} -{" "}
                    {s.periods[s.periods.length - 1]}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

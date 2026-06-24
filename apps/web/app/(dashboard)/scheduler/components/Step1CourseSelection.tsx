"use client";

import { useState, useRef } from "react";
import { schedulerService, Section } from "@/lib/scheduler";
import {
  UploadCloud,
  Loader2,
  CheckCircle2,
  FileSpreadsheet,
  X,
  Check,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

interface Props {
  sections: Section[];
  setSections: (s: Section[]) => void;
  onNext: (selected: string[]) => void;
  initialSelectedCodes?: string[];
}

export default function Step1CourseSelection({
  sections,
  setSections,
  onNext,
  initialSelectedCodes = [],
}: Props) {
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(() => {
    const mapped = (initialSelectedCodes || []).map((code) =>
      code.endsWith(".1") || code.endsWith(".2") ? code.slice(0, -2) : code
    );
    return new Set(mapped);
  });
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await schedulerService.uploadTkb(file);
      if (res.ok && res.data) {
        setSections(res.data.sections);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const toggleCourse = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedCodes(next);
  };

  // Group sections by base course code for selection list (merging .1/.2 labs)
  const uniqueCourses = sections.reduce(
    (acc, s) => {
      const endsWithLabSuffix = s.course_code.endsWith(".1") || s.course_code.endsWith(".2");
      const isLab = s.is_lab || s.teaching_type === "HT1" || s.teaching_type === "HT2" || endsWithLabSuffix;
      const baseCode = endsWithLabSuffix ? s.course_code.slice(0, -2) : s.course_code;

      if (!acc[baseCode]) {
        acc[baseCode] = {
          code: baseCode,
          name: s.course_name,
          baseCredits: 0,
          labCredits: 0,
          credits: 0,
        };
      }

      const item = acc[baseCode];

      if (isLab) {
        item.labCredits = s.credits;
      } else {
        item.baseCredits = s.credits;
        item.name = s.course_name;
      }

      item.credits = item.baseCredits + item.labCredits;
      return acc;
    },
    {} as Record<
      string,
      {
        code: string;
        name: string;
        baseCredits: number;
        labCredits: number;
        credits: number;
      }
    >,
  );

  const filteredCourses = (
    Object.values(uniqueCourses) as Array<{
      code: string;
      name: string;
      credits: number;
    }>
  ).filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const displayCourses = filteredCourses.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  const totalCredits = Array.from(selectedCodes).reduce(
    (acc, code) => acc + (uniqueCourses[code]?.credits || 0),
    0,
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Upload Area */}
      <section className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl relative overflow-hidden group">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 relative z-10">
            <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              Nguồn Dữ Liệu TKB
            </h2>
            <p className="text-sm text-neutral-400 max-w-xl leading-relaxed">
              Tải lên file Excel TKB dự kiến từ nhà trường để hệ thống phân tích
              và tự động đưa ra các đề xuất lịch học phù hợp nhất cho bạn.
            </p>
          </div>

          <div className="flex items-center gap-4 relative z-10">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".xlsx,.xls"
            />
            {sections.length > 0 && (
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-5 py-2.5 bg-white text-black hover:bg-neutral-200 transition-colors rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
              {sections.length > 0 ? "Tải lại Excel" : "Tải lên Excel"}
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Selected Courses */}
        <div className="lg:col-span-7">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg shadow-black/20 flex flex-col h-[600px]">
            <div className="p-5 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-sm flex justify-between items-center bg-neutral-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-white">Môn học đã chọn</h3>
              </div>
              <span className="text-xs font-medium text-neutral-400 bg-neutral-800 px-2 py-1 rounded-full">{selectedCodes.size} môn</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-neutral-900">
              {selectedCodes.size === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-neutral-500 text-sm p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-neutral-700 mb-2" />
                  <p>Chưa chọn môn học nào.</p>
                  <p className="text-xs text-neutral-600">Hãy chọn các môn từ danh sách bên phải.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {Array.from(selectedCodes).map((code) => {
                    const course = uniqueCourses[code];
                    if (!course) return null;
                    return (
                      <div
                        key={code}
                        className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center justify-between group transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 hover:scale-[1.01]"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-xs">
                            {course.credits} TC
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-white mb-0.5">{course.name}</h4>
                            <span className="text-xs text-neutral-500 font-medium px-2 py-0.5 rounded bg-neutral-800">{course.code}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleCourse(code)}
                          className="p-2 hover:bg-neutral-850 text-neutral-500 hover:text-white rounded-lg transition-colors flex items-center justify-center ml-4 shrink-0"
                          title="Bỏ chọn"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected List & Action */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg shadow-black/20 flex flex-col h-[600px]">
            <div className="p-5 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-sm flex justify-between items-center">
              <h3 className="text-base font-semibold text-white">
                Danh sách môn học
              </h3>
              <span className="text-xs font-medium text-neutral-400 bg-neutral-800 px-2 py-1 rounded-full">
                {selectedCodes.size} môn
              </span>
            </div>

            {/* Search Input */}
            {sections.length > 0 && (
              <div className="p-3 border-b border-neutral-800">
                <input
                  type="text"
                  placeholder="Tìm kiếm mã hoặc tên môn học..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-500 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            )}

            {/* Checkbox List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-neutral-900">
              {sections.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-sm gap-3 p-6 text-center">
                  <FileSpreadsheet className="w-8 h-8 text-neutral-700 mb-2" />
                  <p>Bạn chưa tải lên dữ liệu</p>
                  <p className="text-xs text-neutral-600">
                    Hãy upload file TKB để xem danh sách môn học
                  </p>
                </div>
              ) : displayCourses.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500 text-center">
                  Không tìm thấy môn học
                </div>
              ) : (
                <div className="divide-y divide-neutral-800/50">
                  {displayCourses.map((course) => {
                    const isSelected = selectedCodes.has(course.code);
                    return (
                      <div
                        key={course.code}
                        onClick={() => toggleCourse(course.code)}
                        className={`flex items-center justify-between p-3 hover:bg-neutral-800/80 cursor-pointer transition-all duration-300 border-l-2 ${isSelected ? "bg-indigo-500/5 border-l-indigo-500 pl-2.5" : "border-l-transparent pl-3"}`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${isSelected ? "bg-indigo-500 text-white" : "bg-neutral-800 text-neutral-400 border border-neutral-700"}`}
                          >
                            {course.credits} TC
                          </div>
                          <div>
                            <p
                              className={`text-sm font-medium transition-colors duration-300 ${isSelected ? "text-indigo-400 font-semibold" : "text-white"}`}
                            >
                              {course.name}
                            </p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {course.code}
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-4 mr-2">
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center transition-all duration-300 ${isSelected ? "bg-indigo-500 scale-105 shadow-sm shadow-indigo-500/20" : "border border-neutral-600 bg-transparent"}`}
                          >
                            {isSelected && (
                              <Check
                                className="w-3.5 h-3.5 text-white animate-in fade-in zoom-in-75 duration-200"
                                strokeWidth={3}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-neutral-800 bg-neutral-900">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">Tổng tín chỉ</span>
                  <span
                    className={`text-lg font-semibold ${totalCredits > 0 && totalCredits < 14 ? "text-orange-400" : "text-white"}`}
                  >
                    {totalCredits}
                  </span>
                </div>

                {totalCredits > 0 && totalCredits < 14 && (
                  <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-orange-400 leading-relaxed">
                      Số tín chỉ hiện tại <strong>dưới 14</strong>. Bạn nên chọn
                      thêm môn để đảm bảo tiến độ học tập theo quy định của
                      trường (tối thiểu 14 tín chỉ mỗi học kỳ).
                    </p>
                  </div>
                )}
              </div>

              <button
                disabled={selectedCodes.size === 0}
                onClick={() => onNext(Array.from(selectedCodes))}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-900/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                Tiếp tục thiết lập <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

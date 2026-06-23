"use client";

import { useState, useEffect, useRef } from "react";
import { schedulerService, Section, RecommendedCourse } from "@/lib/scheduler";

interface Props {
  sections: Section[];
  setSections: (s: Section[]) => void;
  onNext: (selected: string[]) => void;
}

export default function Step1CourseSelection({ sections, setSections, onNext }: Props) {
  const [recommendations, setRecommendations] = useState<RecommendedCourse[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sections.length > 0) {
      loadRecommendations();
    }
  }, [sections]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const codes = Array.from(new Set(sections.map(s => s.course_code)));
      const res = await schedulerService.getRecommendations(codes);
      if (res.ok && res.data) {
        setRecommendations(res.data.recommendations);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  // Group sections by course code for selection list
  const uniqueCourses = sections.reduce((acc, s) => {
    if (!acc[s.course_code]) {
      acc[s.course_code] = {
        code: s.course_code,
        name: s.course_name,
        credits: s.credits,
      };
    }
    return acc;
  }, {} as Record<string, { code: string; name: string; credits: number }>);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Upload Area */}
      <section className="bg-[#0a0a0a] border border-[#1a1a1a] p-6 rounded-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-2 text-[10px] font-mono text-neutral-800">DATA_INPUT_01</div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-white">Cấu hình dữ liệu TKB</h2>
            <p className="text-sm text-neutral-400 max-w-md">
              Tải lên file Excel TKB dự kiến từ trường để hệ thống phân tích và đề xuất lịch phù hợp.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden" 
              accept=".xlsx,.xls"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 hover:bg-neutral-800 transition-all text-sm font-mono flex items-center gap-2 group"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              {sections.length > 0 ? "CẬP NHẬT TKB" : "TẢI LÊN EXCEL"}
            </button>
            {sections.length > 0 && (
              <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-sm">
                <span className="text-[10px] font-mono text-emerald-400">READY: {sections.length} SECTIONS</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recommendations */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-[2px] bg-cyan-500" />
            <h3 className="text-sm font-mono tracking-widest uppercase font-bold">Gợi ý thông minh</h3>
          </div>
          
          <div className="space-y-3">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 text-neutral-600 font-mono text-xs">
                <div className="w-8 h-8 border-t-2 border-cyan-500 border-r-transparent rounded-full animate-spin" />
                <p>ANALYZING_CURRICULUM...</p>
              </div>
            ) : recommendations.length > 0 ? (
              recommendations.slice(0, 8).map((rec) => (
                <button
                  key={rec.course_code}
                  onClick={() => toggleCourse(rec.course_code)}
                  className={`w-full text-left p-4 border transition-all duration-300 flex items-center justify-between group ${
                    selectedCodes.has(rec.course_code) 
                      ? 'bg-cyan-500/5 border-cyan-500/50' 
                      : 'bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#333]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 flex items-center justify-center font-mono text-xs border ${
                      selectedCodes.has(rec.course_code) ? 'border-cyan-500 text-cyan-400' : 'border-neutral-800 text-neutral-500'
                    }`}>
                      {rec.score.toFixed(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">{rec.course_name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-mono text-neutral-500 uppercase">{rec.course_code}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-800" />
                        <span className="text-[10px] font-mono text-neutral-500 uppercase">{rec.credits} TÍN CHỈ</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {selectedCodes.has(rec.course_code) ? (
                      <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-neutral-800 group-hover:border-neutral-600" />
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="py-20 border border-dashed border-[#1a1a1a] rounded-sm flex flex-col items-center justify-center gap-3 text-neutral-600 italic text-sm">
                <p>Chưa có dữ liệu đề xuất. Hãy tải lên TKB trước.</p>
              </div>
            )}
          </div>
        </div>

        {/* Selected List & Action */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-[2px] bg-violet-500" />
            <h3 className="text-sm font-mono tracking-widest uppercase font-bold">Danh sách đã chọn</h3>
          </div>

          <div className="bg-[#0a0a0a] border border-[#1a1a1a] min-h-[400px] flex flex-col">
            <div className="flex-1 p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
              {selectedCodes.size === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-600 italic text-xs gap-3 py-20">
                  <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p>Chưa có môn nào được chọn</p>
                </div>
              ) : (
                Array.from(selectedCodes).map(code => (
                  <div key={code} className="flex items-center justify-between p-3 bg-neutral-900/50 border border-neutral-800/50 group">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-neutral-200">{uniqueCourses[code]?.name || code}</p>
                      <p className="text-[10px] font-mono text-neutral-500">{code}</p>
                    </div>
                    <button 
                      onClick={() => toggleCourse(code)}
                      className="text-neutral-600 hover:text-rose-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-[#1a1a1a] bg-neutral-900/20 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-500 uppercase">Tổng số môn:</span>
                <span className="text-white">{selectedCodes.size}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-500 uppercase">Tổng tín chỉ:</span>
                <span className="text-white">
                  {Array.from(selectedCodes).reduce((acc, code) => acc + (uniqueCourses[code]?.credits || 0), 0)}
                </span>
              </div>
              
              <button
                disabled={selectedCodes.size === 0}
                onClick={() => onNext(Array.from(selectedCodes))}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-violet-600 text-white font-mono text-sm font-bold tracking-widest disabled:opacity-30 disabled:grayscale transition-all hover:scale-[1.01] active:scale-[0.99] shadow-[0_4px_20px_rgba(6,182,212,0.2)]"
              >
                TIẾP TỤC {">"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

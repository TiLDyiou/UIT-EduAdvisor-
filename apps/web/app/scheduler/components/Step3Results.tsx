"use client";

import { useState } from "react";
import { ScheduleSolution, Section, schedulerService } from "@/lib/scheduler";

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

const PERIODS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Step3Results({ solutions, sections, onBack }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [exporting, setExporting] = useState(false);

  const selectedSolution = solutions[selectedIndex];

  const handleExport = async () => {
    if (!selectedSolution) return;
    setExporting(true);
    try {
      // Find full section details from original sections list
      const solutionSections = selectedSolution.sections.map(ss => {
        return sections.find(s => s.course_code === ss.course_code && s.section_code === ss.section_code)!;
      }).filter(Boolean);

      await schedulerService.exportIcs({
        sections: solutionSections,
        term_start: new Date().toISOString().split('T')[0], // Placeholder, in real app would be from config
        term_weeks: 15,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  if (solutions.length === 0) {
    return (
      <div className="py-20 border border-dashed border-rose-500/20 bg-rose-500/5 rounded-sm flex flex-col items-center justify-center gap-6 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white font-mono uppercase tracking-widest">Không tìm thấy phương án</h3>
          <p className="text-neutral-400 max-w-md mx-auto text-sm">
            Hệ thống không thể xếp được lịch thỏa mãn các điều kiện của bạn. Hãy thử giảm số môn chọn hoặc mở rộng khung giờ rảnh.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-8 py-3 bg-neutral-900 border border-neutral-800 text-white font-mono text-sm tracking-widest hover:border-neutral-600 transition-all"
        >
          QUAY LẠI CHỈNH SỬA
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-[2px] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <h3 className="text-sm font-mono tracking-widest uppercase font-bold text-emerald-400">Kết quả xếp lịch tối ưu</h3>
          </div>
          <div className="flex gap-2">
            {solutions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`px-6 py-2 font-mono text-xs tracking-widest transition-all ${
                  selectedIndex === idx 
                    ? 'bg-white text-black font-bold' 
                    : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-600'
                }`}
              >
                PHƯƠNG ÁN 0{idx + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="px-6 py-2.5 border border-neutral-800 text-neutral-400 font-mono text-[10px] tracking-widest hover:bg-neutral-900 transition-all"
          >
            THAY ĐỔI RÀNG BUỘC
          </button>
          <button 
            onClick={handleExport}
            disabled={exporting}
            className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold tracking-widest transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          >
            {exporting ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            XUẤT FILE .ICS
          </button>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-1 md:p-4 overflow-x-auto custom-scrollbar">
        <div className="min-w-[800px] grid grid-cols-[80px_repeat(7,1fr)] gap-px bg-[#1a1a1a] border border-[#1a1a1a]">
          {/* Header */}
          <div className="h-10 bg-[#050505]" />
          {DAYS.map(d => (
            <div key={d.value} className="h-10 bg-[#050505] flex items-center justify-center text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
              {d.label}
            </div>
          ))}

          {/* Grid with Sections */}
          {PERIODS.map(p => (
            <React.Fragment key={p}>
              <div className="h-16 bg-[#050505] flex items-center justify-center text-[10px] font-mono text-neutral-700">
                T{p}
              </div>
              {DAYS.map(d => {
                const section = selectedSolution.sections.find(s => s.day_of_week === d.value && s.periods.includes(p));
                const isStart = section && section.periods[0] === p;
                
                if (section) {
                  return (
                    <div 
                      key={`${d.value}-${p}`} 
                      className={`relative bg-neutral-900 border-x border-neutral-800 ${isStart ? 'border-t border-cyan-500/50' : ''} ${p === section.periods[section.periods.length-1] ? 'border-b border-cyan-500/20' : ''}`}
                    >
                      {isStart && (
                        <div className="absolute inset-0 p-2 overflow-hidden z-10">
                          <div className="text-[10px] font-bold text-white leading-tight truncate">{section.course_name}</div>
                          <div className="text-[9px] font-mono text-cyan-500 mt-1">{section.section_code}</div>
                          <div className="text-[8px] font-mono text-neutral-500 mt-2 flex items-center gap-1">
                            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {section.room || "N/A"}
                          </div>
                        </div>
                      )}
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
                    </div>
                  );
                }

                return <div key={`${d.value}-${p}`} className="h-16 bg-[#050505]" />;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {selectedSolution.sections.map(s => (
          <div key={`${s.course_code}-${s.section_code}`} className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] flex flex-col justify-between group hover:border-neutral-700 transition-colors">
            <div>
              <div className="flex items-start justify-between">
                <h4 className="text-sm font-semibold text-white">{s.course_name}</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-500">{s.course_code}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-neutral-600 uppercase">Phòng</p>
                  <p className="text-xs text-neutral-300">{s.room || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-neutral-600 uppercase">Giảng viên</p>
                  <p className="text-xs text-neutral-300 truncate">{s.instructor_name || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from "react";

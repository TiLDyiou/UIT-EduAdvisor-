"use client";

import React, { useState } from "react";
import { TimeSlot } from "@/lib/scheduler";
import { CalendarDays, Loader2, Sparkles, XCircle, CheckCircle2, CalendarClock, AlertCircle } from "lucide-react";

interface Props {
  onSolve: (slots: TimeSlot[] | null) => void;
  loading: boolean;
  error?: string | null;
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
    case 1: return "07:30 - 08:15";
    case 2: return "08:15 - 09:00";
    case 3: return "09:00 - 09:45";
    case 4: return "09:45 - 10:30";
    case 5: return "10:30 - 11:15";
    case 6: return "13:00 - 13:45";
    case 7: return "13:45 - 14:30";
    case 8: return "14:30 - 15:15";
    case 9: return "15:15 - 16:00";
    case 10: return "16:00 - 16:45";
    default: return "";
  }
};

export default function Step2TimePreference({ onSolve, loading, error }: Props) {
  const [availableSlots, setAvailableSlots] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    DAYS.forEach(d => {
      PERIODS.forEach(p => {
        initial.add(`${d.value}-${p}`);
      });
    });
    return initial;
  });

  const toggleSlot = (day: number, period: number) => {
    const key = `${day}-${period}`;
    const next = new Set(availableSlots);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setAvailableSlots(next);
  };

  const toggleDay = (day: number) => {
    const daySlots = PERIODS.map(p => `${day}-${p}`);
    const allSelected = daySlots.every(s => availableSlots.has(s));
    const next = new Set(availableSlots);
    if (allSelected) {
      daySlots.forEach(s => next.delete(s));
    } else {
      daySlots.forEach(s => next.add(s));
    }
    setAvailableSlots(next);
  };

  const handleSolve = () => {
    const slots: TimeSlot[] = Array.from(availableSlots).map(s => {
      const [day, period] = s.split("-").map(Number);
      return { day, period };
    });
    onSolve(slots);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl relative overflow-hidden group">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-400" />
              Tùy Chọn Thời Gian Biểu
            </h2>
            <p className="text-sm text-neutral-400 max-w-xl leading-relaxed">
              Bạn rảnh vào những khung giờ nào? Hệ thống sẽ ưu tiên và né các buổi bận của bạn để tìm ra thời khóa biểu tối ưu nhất.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const all = new Set<string>();
                DAYS.forEach(d => PERIODS.forEach(p => all.add(`${d.value}-${p}`)));
                setAvailableSlots(all);
              }}
              className="px-4 py-2 border border-neutral-700 hover:bg-neutral-800 rounded-lg text-sm text-neutral-300 font-medium transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Đặt tất cả là rảnh
            </button>
            <button 
              onClick={() => setAvailableSlots(new Set())}
              className="px-4 py-2 border border-neutral-700 hover:bg-neutral-800 rounded-lg text-sm text-neutral-300 font-medium transition-colors flex items-center gap-2"
            >
              <XCircle className="w-4 h-4 text-red-400" /> Đặt tất cả là bận
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      </section>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg shadow-black/10">
        <div className="p-6 overflow-x-auto custom-scrollbar">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-2">
              {/* Header */}
              <div className="h-12" />
              {DAYS.map(d => (
                <button 
                  key={d.value}
                  onClick={() => toggleDay(d.value)}
                  className="h-12 flex items-center justify-center font-medium text-sm text-neutral-400 hover:text-indigo-400 transition-colors bg-neutral-950/50 rounded-lg"
                >
                  {d.label}
                </button>
              ))}

              {/* Periods */}
              {PERIODS.map(p => (
                <React.Fragment key={p}>
                  <div className="h-12 flex flex-col items-end justify-center pr-4 font-medium">
                    <span className="text-xs text-neutral-300">Tiết {p}</span>
                    <span className="text-[10px] text-neutral-500">{getPeriodTime(p)}</span>
                  </div>
                  {DAYS.map(d => {
                    const isAvailable = availableSlots.has(`${d.value}-${p}`);
                    return (
                      <button
                        key={`${d.value}-${p}`}
                        onClick={() => toggleSlot(d.value, p)}
                        className={`h-12 rounded-lg transition-all duration-200 group relative overflow-hidden ${
                          isAvailable 
                            ? 'bg-neutral-950/20 border border-neutral-800 hover:bg-neutral-850/40' 
                            : 'bg-red-500/5 border border-red-500/20 hover:bg-red-500/10'
                        }`}
                        title={`${d.label} - Tiết ${p} (${getPeriodTime(p)}) (${isAvailable ? "Rảnh" : "Bận"})`}
                      >
                        {!isAvailable && (
                          <svg className="absolute inset-0 w-full h-full text-red-500/50 animate-in fade-in zoom-in-75 duration-200" preserveAspectRatio="none">
                            <line x1="0" y1="0" x2="100%" y2="100%" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="100%" y1="0" x2="0" y2="100%" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4">
        <button
          disabled={loading}
          onClick={handleSolve}
          className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-md shadow-indigo-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Đang tính toán...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> Tìm Lịch Học Tối Ưu
            </>
          )}
        </button>
      </div>

      {error && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes errorWiggle {
              0%, 100% { transform: translateX(0); }
              20%, 60% { transform: translateX(-4px); }
              40%, 80% { transform: translateX(4px); }
            }
            .error-wiggle-anim {
              animation: errorWiggle 0.4s ease-in-out;
            }
          `}} />
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 mt-4 animate-in slide-in-from-top-4 error-wiggle-anim duration-300">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
          </div>
        </>
      )}
    </div>
  );
}

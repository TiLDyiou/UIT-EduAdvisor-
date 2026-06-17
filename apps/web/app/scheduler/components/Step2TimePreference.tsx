"use client";

import { useState } from "react";
import { TimeSlot } from "@/lib/scheduler";

interface Props {
  onBack: () => void;
  onSolve: (slots: TimeSlot[] | null) => void;
  loading: boolean;
}

const DAYS = [
  { label: "THỨ 2", value: 2 },
  { label: "THỨ 3", value: 3 },
  { label: "THỨ 4", value: 4 },
  { label: "THỨ 5", value: 5 },
  { label: "THỨ 6", value: 6 },
  { label: "THỨ 7", value: 7 },
  { label: "CN", value: 8 },
];

const PERIODS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Step2TimePreference({ onBack, onSolve, loading }: Props) {
  // We store 'busy' slots. By default, all are free (null available_slots in API means all free)
  // But here we'll let user mark slots they ARE available or NOT.
  // Actually, the solver takes 'available_slots'. So we select available ones.
  // Let's default to all selected (all available).
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
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <section className="bg-[#0a0a0a] border border-[#1a1a1a] p-6 rounded-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 text-[10px] font-mono text-neutral-800">CONFIG_AVAIL_02</div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-white">Thời gian biểu mong muốn</h2>
            <p className="text-sm text-neutral-400 max-w-md">
              Chọn các buổi bạn <span className="text-cyan-400 font-bold">CÓ THỂ</span> đi học. Hệ thống sẽ né các buổi không được chọn.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const all = new Set<string>();
                DAYS.forEach(d => PERIODS.forEach(p => all.add(`${d.value}-${p}`)));
                setAvailableSlots(all);
              }}
              className="px-3 py-1 text-[10px] font-mono border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 transition-all"
            >
              CHỌN TẤT CẢ
            </button>
            <button 
              onClick={() => setAvailableSlots(new Set())}
              className="px-3 py-1 text-[10px] font-mono border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 transition-all"
            >
              BỎ CHỌN HẾT
            </button>
          </div>
        </div>
      </section>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 md:p-8 overflow-x-auto custom-scrollbar">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-2">
            {/* Header */}
            <div className="h-10" />
            {DAYS.map(d => (
              <button 
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className="h-10 flex items-center justify-center text-[10px] font-mono font-bold tracking-widest text-neutral-500 hover:text-cyan-400 transition-colors uppercase"
              >
                {d.label}
              </button>
            ))}

            {/* Periods */}
            {PERIODS.map(p => (
              <React.Fragment key={p}>
                <div className="h-12 flex items-center justify-end pr-4 text-[10px] font-mono text-neutral-600">
                  TIẾT {p}
                </div>
                {DAYS.map(d => {
                  const isAvailable = availableSlots.has(`${d.value}-${p}`);
                  return (
                    <button
                      key={`${d.value}-${p}`}
                      onClick={() => toggleSlot(d.value, p)}
                      className={`h-12 border transition-all duration-200 group relative ${
                        isAvailable 
                          ? 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20' 
                          : 'bg-neutral-900/20 border-neutral-800/50 hover:bg-neutral-800/30'
                      }`}
                    >
                      {isAvailable && (
                        <div className="absolute inset-1 border border-cyan-500/20 opacity-50" />
                      )}
                      <div className={`w-1.5 h-1.5 rounded-full absolute top-1 right-1 ${isAvailable ? 'bg-cyan-500 animate-pulse' : 'bg-transparent'}`} />
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="px-8 py-3 border border-neutral-800 text-neutral-400 font-mono text-sm tracking-widest hover:bg-neutral-900 transition-all"
        >
          {"<"} QUAY LẠI
        </button>
        
        <button
          disabled={loading}
          onClick={handleSolve}
          className="px-12 py-3 bg-white text-black font-mono text-sm font-bold tracking-widest hover:bg-cyan-400 transition-all flex items-center gap-3 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              SOLVING...
            </>
          ) : (
            "BẮT ĐẦU XẾP LỊCH >"
          )}
        </button>
      </div>
    </div>
  );
}

// React import for Fragment if needed, or use <>
import React from "react";

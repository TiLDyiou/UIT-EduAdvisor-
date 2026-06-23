"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { schedulerService, Section, RecommendedCourse, ScheduleSolution, TimeSlot } from "@/lib/scheduler";
import Step1CourseSelection from "./components/Step1CourseSelection";
import Step2TimePreference from "./components/Step2TimePreference";
import Step3Results from "./components/Step3Results";

type Step = "selection" | "preference" | "results";

export default function SchedulerPage() {
  const [step, setStep] = useState<Step>("selection");
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[] | null>(null);
  const [solutions, setSolutions] = useState<ScheduleSolution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNextToPreference = (selected: string[]) => {
    setSelectedCourseCodes(selected);
    setStep("preference");
  };

  const handleSolve = async (slots: TimeSlot[] | null) => {
    setAvailableSlots(slots);
    setLoading(true);
    setError(null);
    try {
      const res = await schedulerService.solve({
        sections,
        course_codes: selectedCourseCodes,
        available_slots: slots,
      });
      if (res.ok && res.data) {
        setSolutions(res.data.solutions);
        setStep("results");
      } else {
        setError(res.error || "failed_to_solve");
      }
    } catch (err) {
      setError("system_error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Status Bar / Header */}
      <header className="border-b border-[#1a1a1a] bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-neutral-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"></span>
              <h1 className="text-sm font-mono tracking-wider uppercase font-semibold">UIT_SCHEDULER_V1.0</h1>
            </div>
          </div>
          
          <nav className="flex items-center gap-8">
            <StepIndicator current={step} />
          </nav>

          <div className="hidden md:block">
            <div className="text-[10px] font-mono text-neutral-600 text-right leading-none">
              <p>SYS_STATUS: OPERATIONAL</p>
              <p>MEM_USAGE: LOW</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-mono uppercase">{error}</p>
          </div>
        )}

        <div className="relative">
          {step === "selection" && (
            <Step1CourseSelection 
              sections={sections}
              setSections={setSections}
              onNext={handleNextToPreference}
            />
          )}
          
          {step === "preference" && (
            <Step2TimePreference 
              onBack={() => setStep("selection")}
              onSolve={handleSolve}
              loading={loading}
            />
          )}

          {step === "results" && (
            <Step3Results 
              solutions={solutions}
              sections={sections}
              onBack={() => setStep("preference")}
            />
          )}
        </div>
      </main>

      {/* Decorative Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "selection", label: "SELECT" },
    { key: "preference", label: "AVAIL" },
    { key: "results", label: "SOLVE" },
  ];

  return (
    <div className="flex items-center gap-4">
      {steps.map((s, idx) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className={`text-[10px] font-mono ${current === s.key ? 'text-cyan-400' : 'text-neutral-600'}`}>
            0{idx + 1}
          </span>
          <span className={`text-xs font-mono tracking-widest ${current === s.key ? 'text-white font-bold' : 'text-neutral-500'}`}>
            {s.label}
          </span>
          {idx < steps.length - 1 && (
            <div className="w-4 h-[1px] bg-neutral-800 ml-2" />
          )}
        </div>
      ))}
    </div>
  );
}

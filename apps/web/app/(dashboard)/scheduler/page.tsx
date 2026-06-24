"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { schedulerService, Section, ScheduleSolution, TimeSlot } from "@/lib/scheduler";
import Step1CourseSelection from "./components/Step1CourseSelection";
import Step2TimePreference from "./components/Step2TimePreference";
import Step3Results from "./components/Step3Results";
import { ChevronLeft, CalendarClock, AlertCircle } from "lucide-react";

type Step = "selection" | "preference" | "results";

export default function SchedulerPage() {
  const [step, setStep] = useState<Step>("selection");
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[] | null>(null);
  const [solutions, setSolutions] = useState<ScheduleSolution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem("scheduler_state");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.step) setStep(data.step);
        if (data.sections) setSections(data.sections);
        if (data.selectedCourseCodes) setSelectedCourseCodes(data.selectedCourseCodes);
        if (data.availableSlots) setAvailableSlots(data.availableSlots);
        if (data.solutions) setSolutions(data.solutions);
      } catch (e) {
        console.error("Failed to parse scheduler state", e);
      }
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("scheduler_state", JSON.stringify({
        step,
        sections,
        selectedCourseCodes,
        availableSlots,
        solutions
      }));
    }
  }, [step, sections, selectedCourseCodes, availableSlots, solutions, isClient]);

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
        if (res.data.solutions.length === 0) {
          const hasBusySlots = slots && slots.length < 70;
          if (hasBusySlots) {
            setError("Không xếp được lịch học nào phù hợp do trùng với khung giờ bận của bạn. Vui lòng mở rộng khung giờ rảnh (nhấp bỏ bớt các ô đỏ X) để xếp lịch.");
          } else {
            setError("Không xếp được lịch học nào phù hợp cho các môn đã chọn. Vui lòng quay lại bước trước để thay đổi danh sách môn học.");
          }
        } else {
          setSolutions(res.data.solutions);
          setStep("results");
        }
      } else {
        setError(res.error || "Không thể tạo lịch học. Vui lòng thử lại.");
      }
    } catch (err) {
      setError("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (step === "results") setStep("preference");
    else if (step === "preference") setStep("selection");
    else window.location.href = "/";
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <header className="sticky top-0 z-50 border-b border-neutral-800/50 bg-neutral-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={handleGoBack} className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2 group cursor-pointer">
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium hidden sm:inline">Quay lại</span>
            </button>
            <div className="w-px h-6 bg-neutral-800 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <CalendarClock className="w-4 h-4 text-indigo-400" />
              </div>
              <h1 className="text-base font-semibold text-white tracking-tight">Xếp Lịch Học Thông Minh</h1>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center">
            <StepIndicator current={step} />
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="md:hidden mb-8">
          <StepIndicator current={step} />
        </div>

        {error && step !== "preference" && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        <div className="relative">
          {step === "selection" && (
            <Step1CourseSelection 
              sections={sections}
              setSections={setSections}
              onNext={handleNextToPreference}
              initialSelectedCodes={selectedCourseCodes}
            />
          )}
          
          {step === "preference" && (
            <Step2TimePreference 
              onSolve={handleSolve}
              loading={loading}
              error={error}
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
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "selection", label: "Chọn Môn" },
    { key: "preference", label: "Thời Gian" },
    { key: "results", label: "Kết Quả" },
  ];

  const currentIndex = steps.findIndex(s => s.key === current);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, idx) => {
        const isPast = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex items-center justify-center h-7 px-3 rounded-full text-xs font-medium transition-colors ${
              isCurrent 
                ? 'bg-indigo-500 text-white' 
                : isPast 
                  ? 'bg-neutral-800 text-neutral-300' 
                  : 'bg-neutral-900 text-neutral-500'
            }`}>
              {idx + 1}. {s.label}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-6 h-px ${isPast ? 'bg-neutral-700' : 'bg-neutral-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

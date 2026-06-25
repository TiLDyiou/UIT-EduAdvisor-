"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  schedulerService,
  Section,
  ScheduleSolution,
  TimeSlot,
} from "@/lib/scheduler";
import Step1CourseSelection from "./components/Step1CourseSelection";
import Step2TimePreference from "./components/Step2TimePreference";
import Step3Results from "./components/Step3Results";
import { ChevronLeft, CalendarClock, AlertCircle, X } from "lucide-react";

type Step = "selection" | "preference" | "results";

export default function SchedulerPage() {
  const [step, setStep] = useState<Step>("selection");
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[] | null>(null);
  const [solutions, setSolutions] = useState<ScheduleSolution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const [isClient, setIsClient] = useState(false);

  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    const saved = localStorage.getItem("scheduler_state");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.step) setStep(parsed.step);
        if (parsed.sections) setSections(parsed.sections);
        if (parsed.selectedCourseCodes)
          setSelectedCourseCodes(parsed.selectedCourseCodes);
        if (parsed.availableSlots) setAvailableSlots(parsed.availableSlots);
        if (parsed.solutions) setSolutions(parsed.solutions);
        if (parsed.warnings) setWarnings(parsed.warnings);
      } catch (err) {}
    }
    setLoading(false);
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (toastError) {
      const timer = setTimeout(() => setToastError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastError]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(
        "scheduler_state",
        JSON.stringify({
          step,
          sections,
          selectedCourseCodes,
          availableSlots,
          solutions,
          warnings,
        }),
      );
    }
  }, [
    step,
    sections,
    selectedCourseCodes,
    availableSlots,
    solutions,
    warnings,
    isClient,
  ]);

  const handleNextToPreference = (selected: string[]) => {
    setSelectedCourseCodes(selected);
    setStep("preference");
  };

  const handleSolve = async (
    slots: TimeSlot[] | null,
    isToast: boolean = false,
  ) => {
    setAvailableSlots(slots);
    setLoading(true);
    if (isToast) setToastError(null);
    else setError(null);
    try {
      const res = await schedulerService.solve({
        sections,
        course_codes: selectedCourseCodes,
        available_slots: slots,
      });
      if (res.ok && res.data) {
        setWarnings(res.data.warnings || []);
        if (res.data.solutions.length === 0) {
          const hasBusySlots = slots && slots.length < 70;
          let msg = "";
          if (hasBusySlots) {
            msg =
              "Không xếp được lịch học nào phù hợp do trùng với khung giờ bận của bạn. Vui lòng mở rộng khung giờ rảnh (nhấp bỏ bớt các ô đỏ X) để xếp lịch.";
          } else {
            msg =
              "Không xếp được lịch học nào phù hợp cho các môn đã chọn. Vui lòng quay lại bước trước để thay đổi danh sách môn học.";
          }
          if (isToast) setToastError(msg);
          else setError(msg);
        } else {
          setSolutions(res.data.solutions);
          setStep("results");
        }
      } else {
        const msg = res.error || "Không thể tạo lịch học. Vui lòng thử lại.";
        if (isToast) setToastError(msg);
        else setError(msg);
      }
    } catch (err) {
      const msg = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
      if (isToast) setToastError(msg);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 font-sans -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 px-4 md:px-6 lg:px-8 pt-3 md:pt-5 pb-10">
      {/* Toast Notification */}
      {toastError && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="p-4 bg-red-500/10 border border-red-500/20 shadow-lg rounded-xl flex items-start gap-3 w-80 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 leading-relaxed">{toastError}</p>
            <button
              onClick={() => setToastError(null)}
              className="text-red-400 hover:text-red-300 ml-auto p-1 hover:bg-red-500/10 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto">
        <div className="flex justify-center mb-6">
          <StepIndicator
            current={step}
            onStepChange={(newStep) => {
              if (newStep === "results") {
                handleSolve(availableSlots, true);
              } else {
                setStep(newStep);
              }
            }}
          />
        </div>

        <div className="relative">
          {step === "selection" && (
            <Step1CourseSelection
              sections={sections}
              setSections={setSections}
              onNext={handleNextToPreference}
              onSelectionChange={setSelectedCourseCodes}
              initialSelectedCodes={selectedCourseCodes}
            />
          )}

          {step === "preference" && (
            <Step2TimePreference
              onSolve={handleSolve}
              onSelectionChange={setAvailableSlots}
              initialSlots={availableSlots}
              loading={loading}
              error={error}
            />
          )}

          {step === "results" && (
            <Step3Results
              solutions={solutions}
              sections={sections}
              warnings={warnings}
              onBack={() => setStep("preference")}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function StepIndicator({
  current,
  onStepChange,
}: {
  current: Step;
  onStepChange?: (step: Step) => void;
}) {
  const steps: { key: Step; label: string }[] = [
    { key: "selection", label: "Chọn Môn" },
    { key: "preference", label: "Thời Gian" },
    { key: "results", label: "Kết Quả" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, idx) => {
        const isPast = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const isClickable = !!onStepChange && !isCurrent;

        return (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isClickable) {
                  onStepChange(s.key);
                }
              }}
              aria-disabled={!isClickable}
              className={`flex items-center justify-center h-7 px-3 rounded-full text-xs font-medium transition-all duration-200 ${
                !isClickable
                  ? "cursor-default"
                  : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
              } ${
                isCurrent
                  ? "bg-tokyo-cyan text-tokyo-storm shadow-sm ring-2 ring-[#1e66f5]/20"
                  : isPast
                    ? "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                    : "bg-neutral-100 text-neutral-400 dark:bg-neutral-900/50 dark:text-neutral-500"
              }`}
            >
              {idx + 1}. {s.label}
            </button>
            {idx < steps.length - 1 && (
              <div
                className={`w-6 h-px ${
                  isPast
                    ? "bg-neutral-300 dark:bg-neutral-700"
                    : "bg-neutral-200 dark:bg-neutral-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

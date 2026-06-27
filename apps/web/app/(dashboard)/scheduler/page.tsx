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
import {
  ChevronLeft,
  CalendarClock,
  AlertCircle,
  X,
  RotateCcw,
} from "lucide-react";

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
  const [showResetModal, setShowResetModal] = useState(false);

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

  const handleReset = () => {
    setShowResetModal(true);
  };

  const confirmReset = () => {
    setStep("selection");
    setSections([]);
    setSelectedCourseCodes([]);
    setAvailableSlots(null);
    setSolutions([]);
    setWarnings([]);
    setError(null);
    setToastError(null);
    localStorage.removeItem("scheduler_state");
    setShowResetModal(false);
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 font-sans -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 px-4 md:px-6 lg:px-8 pt-3 md:pt-5 pb-10">
      {/* Reset Modal Overlay */}
      {showResetModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-[600px] rounded-3xl bg-white p-6 dark:bg-neutral-900 lg:p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* close btn */}
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute right-3 top-3 z-50 flex h-9.5 w-9.5 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white sm:right-6 sm:top-6 sm:h-11 sm:w-11"
            >
              <svg
                className="fill-current"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                  fill=""
                ></path>
              </svg>
            </button>

            <div>
              <h4 className="font-semibold text-slate-800 mb-4 text-xl dark:text-white/90">
                Xác nhận Làm mới
              </h4>
              <p className="text-sm leading-6 text-slate-500 dark:text-neutral-400">
                Bạn có chắc chắn muốn xóa toàn bộ dữ liệu xếp lịch hiện tại
                không?
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-neutral-400">
                Hành động này sẽ xóa hết các môn học đã chọn, khung giờ rảnh và
                kết quả xếp lịch. Bạn sẽ phải thiết lập lại từ đầu.
              </p>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end w-full gap-3 mt-8">
                <button
                  onClick={() => setShowResetModal(false)}
                  type="button"
                  className="flex w-full justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 sm:w-auto"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={confirmReset}
                  type="button"
                  className="flex justify-center w-full px-4 py-3 text-sm font-medium text-slate-50 rounded-lg bg-rose-500 shadow-sm hover:bg-rose-600 sm:w-auto"
                >
                  Đồng ý, Xóa dữ liệu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="relative flex justify-center items-center mb-6">
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
          <button
            onClick={handleReset}
            title="Làm mới toàn bộ dữ liệu xếp lịch"
            className="absolute right-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded-xl transition-colors border border-rose-200 dark:border-rose-500/20 shadow-sm hover:shadow"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Làm mới
          </button>
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronRight,
  Lock,
  User,
  Bot,
  Calendar,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

import { apiFetch } from "@/lib/api";

type CaptchaPayload = {
  captcha_state_id: string;
  question: string;
  image_base64: string | null;
};

type StartPayload = { job_id: string; student_id: string };

type SyncEvent = {
  stage: string;
  progress_percent: number;
  message: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  daa_profile: "Tải hồ sơ DAA",
  daa_grades: "Đồng bộ điểm",
  daa_schedule: "Đồng bộ thời khóa biểu",
  daa_exams: "Đồng bộ lịch thi",
  moodle_authenticating: "Đăng nhập Moodle",
  persisting: "Hoàn tất lưu dữ liệu",
  completed: "Hoàn tất",
  failed: "Lỗi",
};

const STAGE_PROGRESS: Record<string, number> = {
  daa_profile: 15,
  daa_grades: 35,
  daa_schedule: 55,
  daa_exams: 75,
  moodle_authenticating: 90,
  persisting: 100,
};

const STAGE_ORDER = [
  "daa_profile",
  "daa_grades",
  "daa_schedule",
  "daa_exams",
  "moodle_authenticating",
  "persisting",
];

function SyncGraphic({
  events,
  error,
  onComplete,
}: {
  events: SyncEvent[];
  error: string | null;
  onComplete: () => void;
}) {
  const latest = events[events.length - 1];
  const isFailed = latest?.stage === "failed" || !!error;
  const isCompleted = latest?.stage === "completed";

  const [buffer, setBuffer] = useState(10);
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [simulatedIndex, setSimulatedIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<Set<string>>(
    new Set(),
  );
  const [activeStage, setActiveStage] = useState<string | null>("daa_profile");

  // Simulation state machine for real-time visual progress
  useEffect(() => {
    if (isFailed) return;

    const currentStage = STAGE_ORDER[simulatedIndex];
    if (!currentStage) {
      // Tự động chuyển hướng sau 1.5 giây khi đã hoàn thành các bước
      const delayTimer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(delayTimer);
    }

    const stageTarget = STAGE_PROGRESS[currentStage] ?? 0;

    const timer = setInterval(() => {
      setDisplayedProgress((prev) => {
        if (prev >= stageTarget) {
          clearInterval(timer);

          // Trì hoãn 200ms để vòng tròn cyan hoàn tất vẽ full circle 100%
          setTimeout(() => {
            setCompletedStages((prevSet) => {
              const next = new Set(prevSet);
              next.add(currentStage);
              return next;
            });
            setActiveStage(null);

            // Chờ thêm 800ms cho hiệu ứng success-pop chạy xong rồi mới qua stage tiếp theo
            setTimeout(() => {
              const nextIndex = simulatedIndex + 1;
              setSimulatedIndex(nextIndex);
              if (nextIndex < STAGE_ORDER.length) {
                setActiveStage(STAGE_ORDER[nextIndex]);
              } else {
                setActiveStage(null);
              }
            }, 800);
          }, 200);

          return stageTarget;
        }
        // Giảm tốc độ xuống 0.45 để progress chạy từ từ, mượt mà và an toàn về mặt thời gian
        return Math.min(stageTarget, prev + 0.45);
      });
    }, 30);

    return () => clearInterval(timer);
  }, [simulatedIndex, isFailed, onComplete]);

  // LinearBuffer effect
  useEffect(() => {
    if (isCompleted || isFailed) {
      setBuffer(100);
      return;
    }
    const timer = setInterval(() => {
      setBuffer((prev) => {
        if (displayedProgress >= 100) return 100;
        const flex = Math.random() * 5 + 2;
        if (prev < displayedProgress + 20 && prev < 100) {
          return Math.min(100, prev + flex);
        }
        return prev;
      });
    }, 300);
    return () => clearInterval(timer);
  }, [displayedProgress, isCompleted, isFailed]);

  const stages = STAGE_ORDER;

  return (
    <div className="w-full max-w-xl space-y-6 animate-in fade-in slide-in-from-right-8 duration-700 z-20">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes success-pop {
          0% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { transform: scale(1.03); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes shimmer-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes pulse-bright {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `,
        }}
      />

      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-1 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>Tiến trình đồng bộ</span>
        </div>
        <h2 className="text-3xl font-light tracking-tight text-white">
          {isCompleted
            ? "Dữ liệu đã sẵn sàng."
            : isFailed
              ? "Đồng bộ gián đoạn."
              : "Đang kết nối hệ thống..."}
        </h2>
        <p className="text-slate-400 text-sm font-light leading-relaxed">
          {isCompleted
            ? "Tuyệt vời! Tất cả thông tin học tập của bạn đã được cập nhật thành công."
            : isFailed
              ? "Đã xảy ra lỗi trong quá trình xử lý. Vui lòng thử lại."
              : latest?.message ||
                "Đang thiết lập kênh giao tiếp an toàn với hệ thống trường."}
        </p>
      </div>

      <div className="space-y-4 p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md shadow-2xl">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              {isCompleted ? (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
              ) : isFailed ? (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                </>
              )}
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-widest ${isCompleted ? "text-emerald-400" : isFailed ? "text-red-400" : "text-cyan-400"}`}>
              {isCompleted ? "Hoàn tất" : isFailed ? "Gián đoạn" : "Đang xử lý"}
            </span>
          </div>
          <div className="flex items-baseline gap-0.5 pr-1">
            <span className={`text-4xl font-mono font-light tracking-tighter ${isCompleted ? "text-emerald-400" : isFailed ? "text-red-400" : "text-cyan-400"}`}>
              {Math.round(displayedProgress)}
            </span>
            <span className={`text-xl font-light ${isCompleted ? "text-emerald-500/50" : isFailed ? "text-red-500/50" : "text-cyan-500/50"}`}>
              %
            </span>
          </div>
        </div>

        {/* Segmented Progress Bar */}
        <div className="flex items-center gap-x-1.5 w-full mt-3">
          {Array.from({ length: 10 }).map((_, i) => {
            const min = i * 10;
            const max = (i + 1) * 10;
            let percent = 0;
            if (displayedProgress >= max) percent = 100;
            else if (displayedProgress > min) percent = ((displayedProgress - min) / 10) * 100;

            const isCurrent = percent > 0 && percent < 100;
            const isFilled = percent === 100;

            let fillClass = "bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]";
            if (isFailed) fillClass = "bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]";
            else if (isCompleted) fillClass = "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]";

            return (
              <div
                key={i}
                className="w-full h-3 flex flex-col justify-center rounded-[3px] bg-slate-800/80 overflow-hidden relative border border-slate-700/60 backdrop-blur-md shadow-inner"
              >
                {/* Buffer Layer */}
                <div
                  className="absolute top-0 left-0 h-full bg-slate-600/30 transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, ((buffer - min) / 10) * 100))}%` }}
                />
                
                {/* Progress Layer */}
                <div
                  className={`absolute top-0 left-0 h-full transition-all duration-[400ms] ease-out ${fillClass}`}
                  style={{ width: `${percent}%` }}
                >
                  {/* Shimmer Effect */}
                  {(isFilled || isCurrent) && !isFailed && !isCompleted && (
                    <div className="absolute inset-0 w-full h-full animate-[shimmer-slide_1.2s_infinite_linear] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                  )}
                  {/* Glowing Leading Edge */}
                  {isCurrent && !isFailed && !isCompleted && (
                    <div className="absolute top-0 right-0 h-full w-2 bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.9)] rounded-full translate-x-1 animate-[pulse-bright_1s_infinite_ease-in-out]" />
                  )}
                </div>
              </div>
            );
          })}
          <div className="ms-2 relative flex items-center justify-center">
            {(!isCompleted && !isFailed && displayedProgress > 0 && displayedProgress < 100) && (
              <div className="absolute -inset-[3px] rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-400 animate-spin opacity-80" />
            )}
            <span
              className={`relative shrink-0 flex justify-center items-center rounded-full transition-all duration-500 z-10 ${
                isCompleted
                  ? "w-7 h-7 bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.6)] scale-110"
                  : isFailed
                    ? "w-6 h-6 bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                    : "w-6 h-6 bg-slate-900 text-cyan-400 border border-slate-700"
              }`}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5" />
              ) : isFailed ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <Activity className={`w-3.5 h-3.5 ${displayedProgress > 0 && displayedProgress < 100 ? "animate-pulse opacity-100" : "opacity-50"}`} />
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {stages.map((stage, idx) => {
          const isDone =
            completedStages.has(stage) || (isCompleted && idx < simulatedIndex);
          const isActive = stage === activeStage && !isCompleted && !isFailed;
          const label = STAGE_LABELS[stage] || stage;

          // Calculate current stage progress ratio for the active stage circle
          let ratio = 0;
          if (isDone) {
            ratio = 1.0;
          } else if (isActive) {
            const prevTarget =
              idx > 0 ? (STAGE_PROGRESS[STAGE_ORDER[idx - 1]] ?? 0) : 0;
            const stageTarget = STAGE_PROGRESS[stage] ?? 100;
            ratio = Math.min(
              1.0,
              Math.max(
                0.0,
                (displayedProgress - prevTarget) / (stageTarget - prevTarget),
              ),
            );
          }

          return (
            <div
              key={stage}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-500 ${
                isDone
                  ? "bg-emerald-500/15 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                  : isActive
                    ? "bg-cyan-500/15 border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.15)] scale-[1.01]"
                    : "bg-slate-900/40 border-slate-800/80"
              }`}
              style={
                isDone
                  ? { animation: "success-pop 0.6s ease-out forwards" }
                  : undefined
              }
            >
              <div className="flex-shrink-0">
                {isDone ? (
                  <div className="relative w-5 h-5 flex items-center justify-center animate-in zoom-in duration-300">
                    <svg className="w-5 h-5 -rotate-90">
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        className="stroke-slate-800 fill-none stroke-[1.5]"
                      />
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        className="stroke-emerald-500 fill-none stroke-[1.5]"
                        strokeDasharray="50.27"
                        strokeDashoffset={0}
                      />
                    </svg>
                    <Check className="w-3 h-3 text-emerald-400 absolute animate-in fade-in zoom-in duration-300" />
                  </div>
                ) : isActive ? (
                  <div className="relative w-5 h-5 flex items-center justify-center">
                    <svg className="w-5 h-5 -rotate-90">
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        className="stroke-slate-800 fill-none stroke-[1.5]"
                      />
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        className="stroke-cyan-400 fill-none stroke-[1.5] transition-all duration-100 ease-out"
                        strokeDasharray="50.27"
                        strokeDashoffset={50.27 * (1 - ratio)}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-800 bg-slate-950/40" />
                )}
              </div>
              <span
                className={`text-sm font-medium ${isDone ? "text-emerald-300" : isActive ? "text-cyan-100" : "text-slate-500"}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {isFailed && error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-3 shadow-lg">
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}
    </div>
  );
}

function PrivacyPolicyPanel() {
  return (
    <div className="w-full max-w-xl flex flex-col animate-in fade-in slide-in-from-right-8 duration-500 max-h-[75vh] z-20">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium mb-4 w-fit shadow-lg">
        <Shield className="w-3.5 h-3.5 text-cyan-400" />
        <span>Chính sách Quyền riêng tư</span>
      </div>
      <h2 className="text-3xl font-light tracking-tight text-white mb-6">
        Cam kết bảo mật dữ liệu
      </h2>

      <div className="overflow-y-auto pr-4 pb-4 space-y-6 text-slate-400 text-sm font-light leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        <p className="text-base text-slate-300 font-light">
          UIT EduAdvisor được xây dựng với nguyên tắc bảo vệ quyền riêng tư của
          sinh viên lên hàng đầu. Các thông tin đăng nhập của bạn được sử dụng
          trực tiếp để chứng thực với hệ thống của trường (DAA/Moodle) và{" "}
          <strong>hoàn toàn không được lưu trữ</strong> trên máy chủ của chúng
          tôi.
        </p>
        <section className="space-y-2 text-slate-300 p-4.5 rounded-2xl bg-slate-900/50 border border-slate-800">
          <h3 className="font-medium text-white text-lg flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-cyan-400 shadow-inner">
              01
            </span>
            Thu thập dữ liệu
          </h3>
          <p className="ml-9 text-slate-400">
            Chúng tôi chỉ đồng bộ và lưu trữ các dữ liệu học tập cần thiết: điểm
            số, thời khóa biểu, lịch thi và hồ sơ sinh viên cơ bản nhằm phục vụ
            quá trình học tập.
          </p>
        </section>
        <section className="space-y-2 text-slate-300 p-4.5 rounded-2xl bg-slate-900/50 border border-slate-800">
          <h3 className="font-medium text-white text-lg flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-cyan-400 shadow-inner">
              02
            </span>
            Sử dụng dữ liệu
          </h3>
          <p className="ml-9 text-slate-400">
            Dữ liệu của bạn được sử dụng duy nhất cho mục đích cung cấp các tính
            năng của EduAdvisor (gợi ý môn học, phân tích học tập, sắp xếp thời
            gian). Chúng tôi cam kết tuyệt đối không chia sẻ dữ liệu với bất kỳ
            bên thứ ba nào.
          </p>
        </section>
        <section className="space-y-2 text-slate-300 p-4.5 rounded-2xl bg-slate-900/50 border border-slate-800">
          <h3 className="font-medium text-white text-lg flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-cyan-400 shadow-inner">
              03
            </span>
            Quyền kiểm soát
          </h3>
          <p className="ml-9 text-slate-400">
            Bạn có toàn quyền yêu cầu xóa vĩnh viễn toàn bộ dữ liệu học tập của
            mình khỏi hệ thống EduAdvisor bất cứ lúc nào thông qua phần Cài đặt
            tài khoản sau khi đăng nhập.
          </p>
        </section>
      </div>
    </div>
  );
}

function DefaultGraphic() {
  return (
    <div className="flex flex-col items-center justify-center text-center w-full h-full animate-in fade-in zoom-in-95 duration-1000 z-20">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes float-large {
          0%, 100% { transform: translateY(0) rotate(2deg) scale(1); }
          50% { transform: translateY(-20px) rotate(-1deg) scale(1.03); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }
        @keyframes float-small {
          0%, 100% { transform: translateY(0) rotate(6deg); }
          50% { transform: translateY(-10px) rotate(3deg); }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes data-stream {
          0% { background-position: 200% 0%; }
          100% { background-position: -200% 0%; }
        }
      `,
        }}
      />

      {/* Epic Hero Interactive Elements */}
      <div className="relative w-full max-w-xl aspect-square max-h-[35vh] flex items-center justify-center mb-8 perspective-1000">
        {/* Massive Background Orbs & Rings */}
        <div className="absolute inset-4 bg-cyan-500/15 blur-[100px] rounded-full animate-pulse" />
        <div className="absolute inset-8 border border-cyan-500/10 rounded-full animate-[spin-slow_30s_linear_infinite] border-dashed opacity-50" />
        <div className="absolute inset-16 border-2 border-emerald-500/10 rounded-full animate-[spin-slow_20s_linear_infinite_reverse] opacity-50" />

        {/* Pulsing Rings */}
        <div className="absolute inset-[32%] border-[1.5px] border-cyan-400/20 rounded-full animate-[pulse-ring_4s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
        <div
          className="absolute inset-[32%] border-[1.5px] border-emerald-400/10 rounded-full animate-[pulse-ring_4s_cubic-bezier(0.4,0,0.6,1)_infinite]"
          style={{ animationDelay: "2s" }}
        />

        {/* Floating Centerpiece */}
        <div
          className="w-40 h-40 rounded-[2rem] bg-slate-900/90 border border-slate-700/60 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center relative z-20 backdrop-blur-xl"
          style={{ animation: "float-large 8s ease-in-out infinite" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/10 to-transparent rounded-[2rem] opacity-50" />
          <Bot className="w-12 h-12 text-cyan-400 mb-1.5 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
          <span className="text-xs font-semibold tracking-wider text-slate-200 mb-2.5">
            UIT Mate
          </span>
          <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-cyan-400 w-full animate-[data-stream_2s_linear_infinite] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.7)_50%,transparent_100%)] bg-[length:200%_100%]" />
          </div>
        </div>

        {/* Orbiting Satellite Card 1 - Schedule */}
        <div
          className="absolute top-[2%] left-[8%] w-40 h-40 rounded-[1.5rem] bg-slate-800/90 border border-slate-700/50 shadow-xl flex flex-col p-4 z-30 backdrop-blur-2xl overflow-hidden"
          style={{
            animation: "float-medium 6s ease-in-out infinite",
            animationDelay: "0.5s",
          }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs text-slate-300 font-medium tracking-wide">
              Lịch học
            </span>
          </div>
          <div className="space-y-2 w-full text-[10px]">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-0.5 text-left">
              <div className="flex justify-between items-center text-emerald-400 font-semibold">
                <span className="font-mono">IT003</span>
                <span className="flex-shrink-0">Thứ 2</span>
              </div>
              <div className="flex justify-between text-[9px] text-emerald-500/80">
                <span>Phòng E3.1</span>
                <span className="font-mono">07:30</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/30 flex flex-col gap-0.5 opacity-60 text-left">
              <div className="flex justify-between items-center text-slate-300 font-medium">
                <span className="font-mono">MA006</span>
                <span className="flex-shrink-0">Thứ 4</span>
              </div>
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>Phòng C2.2</span>
                <span className="font-mono">09:30</span>
              </div>
            </div>
          </div>
        </div>

        {/* Orbiting Satellite Card 2 - GPA */}
        <div
          className="absolute bottom-[5%] right-[2%] w-44 h-36 rounded-[1.5rem] bg-slate-900/95 border border-slate-700/50 shadow-[0_15px_30px_-8px_rgba(0,0,0,0.7)] flex flex-col justify-center p-5 z-30 backdrop-blur-2xl"
          style={{
            animation: "float-large 7s ease-in-out infinite",
            animationDelay: "1s",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
              GPA
            </span>
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              +0.2
            </span>
          </div>
          <div className="flex items-end gap-2 h-14 w-full">
            {[40, 60, 45, 80, 65, 95].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-cyan-900/40 rounded-t-sm relative overflow-hidden"
                style={{ height: `${h}%` }}
              >
                <div
                  className="absolute bottom-0 w-full bg-cyan-400 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                  style={{ height: "100%", animationDelay: `${i * 0.15}s` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Small Decorative Element */}
        <div
          className="absolute top-[18%] right-[8%] w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 shadow-lg flex items-center justify-center z-10 backdrop-blur-md"
          style={{
            animation: "float-small 5s ease-in-out infinite",
            animationDelay: "2s",
          }}
        >
          <Shield className="w-5 h-5 text-cyan-500/50" />
        </div>
      </div>

      <div className="space-y-3.5 max-w-lg z-20">
        <h2 className="text-3xl xl:text-4xl font-light text-white tracking-tight leading-tight">
          Cá nhân hoá <br />
          <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 animate-[data-stream_4s_linear_infinite] bg-[length:200%_auto]">
            lộ trình đại học
          </span>
        </h2>
        <p className="text-slate-400 text-sm xl:text-base leading-relaxed font-light">
          Tự động tổng hợp dữ liệu DAA và Moodle để hỗ trợ bạn lập kế hoạch học
          tập, quản lý điểm số và hỗ trợ đề xuất môn học phù hợp tại UIT.
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [captcha, setCaptcha] = useState<CaptchaPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);

  const [rightPanelView, setRightPanelView] = useState<
    "default" | "privacy" | "sync"
  >("default");

  const loadCaptcha = useCallback(async () => {
    setError(null);
    const r = await apiFetch("/api/v1/onboarding/daa-captcha");
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(
        typeof body?.detail === "string"
          ? body.detail
          : "Không tải được captcha",
      );
      return;
    }
    setCaptcha(await r.json());
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  const imageSrc = useMemo(() => {
    if (!captcha?.image_base64) return null;
    return `data:image/png;base64,${captcha.image_base64}`;
  }, [captcha]);

  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/v1/sync-jobs/${jobId}/events`);
    es.onmessage = (ev) => {
      let payload: SyncEvent | null = null;
      try {
        payload = JSON.parse(ev.data) as SyncEvent;
      } catch {
        return;
      }
      setSyncEvents((prev) => [...prev, payload!]);
      if (payload.stage === "failed") {
        setError(payload.message || "Đồng bộ thất bại");
        return;
      }
      if (payload.stage === "completed") {
        es.close();
      }
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [jobId, router]);

  useEffect(() => {
    if (jobId || busy || syncEvents.length > 0) {
      setRightPanelView("sync");
    }
  }, [jobId, busy, syncEvents.length]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setSyncEvents([]);
    try {
      if (!captcha) {
        setError("Captcha chưa sẵn sàng");
        return;
      }
      const r = await apiFetch("/api/v1/onboarding/start", {
        method: "POST",
        body: JSON.stringify({
          student_code: studentCode,
          password,
          captcha_state_id: captcha.captcha_state_id,
          captcha_answer: captchaAnswer,
          privacy_accepted: privacy,
          tos_accepted: true,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(
          typeof body?.detail === "string"
            ? body.detail
            : "Đăng nhập thất bại — kiểm tra MSSV, mật khẩu hoặc captcha",
        );
        await loadCaptcha();
        return;
      }
      const data = (await r.json()) as StartPayload;
      setJobId(data.job_id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden w-full bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Left Panel */}
      <div className="w-full lg:w-5/12 xl:w-[40%] lg:h-full flex flex-col justify-center px-8 sm:px-16 lg:px-12 xl:px-20 py-12 lg:py-0 border-r border-slate-800/60 bg-slate-950/80 backdrop-blur-3xl relative z-20 shadow-2xl lg:overflow-y-auto">
        <div className="w-full max-w-sm mx-auto space-y-10 py-12">
          <header className="space-y-4">
            <Link
              href="/"
              className="inline-block hover:opacity-80 transition-opacity"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                UIT EduAdvisor
              </p>
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Đồng bộ dữ liệu
            </h1>
            <p className="text-sm text-slate-400 font-light leading-relaxed">
              Nhập thông tin chứng thực (DAA/Moodle) để EduAdvisor thiết lập
              trải nghiệm học tập dành riêng cho bạn.
            </p>
          </header>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 ml-1">
                  Mã số sinh viên
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-900/50 pl-11 pr-4 py-3 text-sm outline-none ring-offset-slate-950 transition-all focus:border-cyan-500 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/20"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    autoComplete="username"
                    required
                    disabled={busy || !!jobId}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 ml-1">
                  Mật khẩu
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-900/50 pl-11 pr-11 py-3 text-sm outline-none ring-offset-slate-950 transition-all focus:border-cyan-500 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/20"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={busy || !!jobId}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-cyan-400 transition-colors focus:outline-none"
                    disabled={busy || !!jobId}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5 shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-300">
                  Mã xác nhận DAA
                </span>
                <button
                  type="button"
                  onClick={() => void loadCaptcha()}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
                  disabled={busy || !!jobId}
                >
                  <RefreshCw className="w-3 h-3" />
                  Làm mới
                </button>
              </div>

              {captcha ? (
                <div className="space-y-4">
                  {imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageSrc}
                      alt="Captcha"
                      className="h-[4.5rem] w-full object-cover rounded-xl border border-slate-700 bg-white"
                    />
                  ) : null}
                  <input
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-3 text-sm outline-none ring-offset-slate-950 transition-all focus:border-cyan-500 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/20 placeholder:text-slate-500"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder={captcha.question}
                    required
                    disabled={busy || !!jobId}
                  />
                </div>
              ) : (
                <div className="h-[4.5rem] rounded-xl border border-slate-800 border-dashed flex items-center justify-center bg-slate-900/20">
                  <Activity className="w-5 h-5 animate-pulse text-slate-600" />
                </div>
              )}
            </div>

            <div className="space-y-3.5 pt-2">
              <label className="flex items-start gap-3 group cursor-pointer">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20 focus:ring-offset-slate-950 cursor-pointer"
                    checked={privacy}
                    onChange={(e) => setPrivacy(e.target.checked)}
                    disabled={busy || !!jobId}
                  />
                </div>
                <div className="text-sm text-slate-400 font-light">
                  Tôi đồng ý với{" "}
                  <button
                    type="button"
                    className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors hover:underline underline-offset-2"
                    onClick={(e) => {
                      e.preventDefault();
                      setRightPanelView("privacy");
                    }}
                  >
                    Chính sách quyền riêng tư
                  </button>
                </div>
              </label>
            </div>

            {error && rightPanelView !== "sync" ? (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || !!jobId || !privacy}
              className="w-full relative group overflow-hidden rounded-xl bg-white px-4 py-3.5 text-sm font-medium text-slate-900 transition-all hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:hover:bg-white"
            >
              <div className="relative z-10 flex items-center justify-center gap-2">
                {busy || !!jobId ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
                    Đang thiết lập...
                  </>
                ) : (
                  <>
                    Bắt đầu đồng bộ
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>
        </div>
      </div>

      {/* Right Panel - Dynamic Layout */}
      <div className="hidden lg:flex w-7/12 xl:w-[60%] lg:h-full relative flex-col overflow-hidden bg-slate-950">
        {/* Abstract Technical Grid Background */}
        <div
          className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Soft Glowing Orbs */}
        <div className="absolute top-1/4 right-1/4 w-[30rem] h-[30rem] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-[30rem] h-[30rem] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[100px] pointer-events-none z-0" />

        {/* Dynamic Content Container - Centers content directly now that header/footer are removed */}
        <div className="relative z-10 w-full h-full flex items-center justify-center p-8 lg:p-12">
          {rightPanelView === "default" && <DefaultGraphic />}
          {rightPanelView === "privacy" && <PrivacyPolicyPanel />}
          {rightPanelView === "sync" && (
            <SyncGraphic
              events={syncEvents}
              error={error}
              onComplete={() => { window.location.href = "/tracker"; }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

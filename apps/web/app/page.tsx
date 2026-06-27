"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  MessageSquare,
  GraduationCap,
  Calculator,
  Calendar,
  Settings,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Compass,
  Award,
  ChevronLeft,
  Upload,
  Lock,
} from "lucide-react";

// Feature Card Props
interface FeatureCardProps {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  badgeText?: string;
}

function FeatureCard({
  href,
  title,
  description,
  icon: Icon,
  colorClass,
  badgeText,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between p-6 rounded-2xl border border-[#414868]/40 bg-[#24283b]/30 hover:bg-[#24283b]/60 transition-all duration-300 hover:-translate-y-1 hover:border-[#7aa2f7]/40 overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-[#7aa2f7]/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-500" />

      <div>
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-xl border border-[#414868]/60 bg-[#1a1b26] mb-5 group-hover:scale-110 group-hover:border-[#7aa2f7]/30 transition-all duration-300 ${colorClass}`}
        >
          <Icon className="w-6 h-6" />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-base font-bold text-[#c0caf5] group-hover:text-[#7dcfff] transition-colors duration-200">
            {title}
          </h3>
          {badgeText && (
            <span className="text-[9px]  font-bold px-1.5 py-0.5 rounded bg-[#bb9af7]/10 text-[#bb9af7] border border-[#bb9af7]/20 uppercase">
              {badgeText}
            </span>
          )}
        </div>

        <p className="text-xs text-[#9aa5ce] leading-relaxed mb-6">
          {description}
        </p>
      </div>

      <div className="flex items-center gap-1.5 text-xs  font-bold text-[#73daca] group-hover:text-[#7dcfff] transition-colors">
        <span>RUN MODULE</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}

// Scroll reveal hook
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

// Feature walkthrough data
const FEATURE_SLIDES = [
  {
    id: "tracker",
    title: "Academic Tracker",
    subtitle: "Theo dõi lộ trình đào tạo",
    description:
      "Tổng quan tiến độ học tập với GPA, tín chỉ tích lũy, lộ trình môn học theo từng học kỳ và lịch thi sắp tới.",
    accent: "var(--slide-tracker-accent)",
    accentBg: "var(--slide-tracker-bg)",
    accentBorder: "var(--slide-tracker-border)",
    href: "/tracker",
    icon: GraduationCap,
  },
  {
    id: "gpa-tools",
    title: "GPA Tools",
    subtitle: "Giả lập và tính điểm mục tiêu",
    description:
      "Tính điểm trung bình cần đạt, dự đoán GPA khi học cải thiện với các công cụ tính toán thông minh.",
    accent: "var(--slide-gpa-accent)",
    accentBg: "var(--slide-gpa-bg)",
    accentBorder: "var(--slide-gpa-border)",
    href: "/gpa-tools",
    icon: Calculator,
  },
  {
    id: "scheduler",
    title: "UIT Scheduler",
    subtitle: "Xếp lịch học tối ưu tự động",
    description:
      "Upload file TKB, chọn môn học, đặt lịch rảnh/bận rồi để AI tìm phương án thời khoá biểu tối ưu nhất.",
    accent: "var(--slide-scheduler-accent)",
    accentBg: "var(--slide-scheduler-bg)",
    accentBorder: "var(--slide-scheduler-border)",
    href: "/scheduler",
    icon: Calendar,
  },
  {
    id: "ai-mate",
    title: "UIT Mate",
    subtitle: "Trợ lý AI hiểu quy chế UIT",
    description:
      "Hỏi đáp trực tiếp về quy chế đào tạo, điều kiện tốt nghiệp, học cải thiện với trợ lý AI được huấn luyện chuyên sâu.",
    accent: "var(--slide-aimate-accent)",
    accentBg: "var(--slide-aimate-bg)",
    accentBorder: "var(--slide-aimate-border)",
    href: "/ai-mate",
    icon: MessageSquare,
  },
] as const;

// Visual mockup for each slide
function TrackerMockup() {
  return (
    <div className="space-y-3">
      {/* GPA Card */}
      <div className="flex gap-3">
        <div className="flex-1 bg-tokyo-night rounded-xl p-4 border border-tokyo-cyan/20">
          <span className="text-[9px] text-tokyo-comment uppercase tracking-wider block ">
            GPA Hệ 10
          </span>
          <span className="text-3xl font-black text-tokyo-cyan mt-1 block">
            8.25
          </span>
          <span className="inline-flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-full mt-2 text-tokyo-green bg-tokyo-green/10 border border-tokyo-green/20">
            <Award className="w-2.5 h-2.5" /> Giỏi
          </span>
        </div>
        <div className="flex-1 bg-tokyo-night rounded-xl p-4 border border-tokyo-border/40">
          <span className="text-[9px] text-tokyo-comment uppercase tracking-wider block ">
            Tín chỉ tích luỹ
          </span>
          <span className="text-3xl font-black text-tokyo-fg mt-1 block">
            45<span className="text-xs text-tokyo-comment">/130</span>
          </span>
          <div className="mt-2 h-1.5 bg-tokyo-storm rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-tokyo-cyan to-tokyo-blue w-[35%]" />
          </div>
        </div>
      </div>
      {/* Roadmap Items */}
      {[
        {
          name: "Nhập môn lập trình",
          code: "IT001",
          status: "Đạt: 8.5",
          color: "var(--color-green)",
        },
        {
          name: "Cấu trúc dữ liệu & GT",
          code: "IT003",
          status: "Đang học",
          color: "var(--color-orange)",
        },
        {
          name: "Hệ điều hành",
          code: "IT007",
          status: "Khoá",
          color: "var(--color-red)",
        },
      ].map((item) => (
        <div
          key={item.code}
          className="flex items-center gap-3 p-2.5 rounded-lg border border-tokyo-border/30 bg-tokyo-night/60"
        >
          <div className="flex-grow min-w-0">
            <p className="text-xs font-bold text-tokyo-variable truncate">
              {item.name}
            </p>
            <span className="text-[9px]  text-tokyo-cyan">{item.code}</span>
          </div>
          <span
            className="text-[8px]  font-bold px-2 py-0.5 rounded border whitespace-nowrap"
            style={{
              color: item.color,
              borderColor: `${item.color}33`,
              backgroundColor: `${item.color}15`,
            }}
          >
            {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function GpaToolsMockup() {
  return (
    <div className="space-y-3">
      {/* Current GPA */}
      <div className="bg-tokyo-night rounded-xl p-4 border border-tokyo-magenta/20 text-center">
        <span className="text-[9px] text-tokyo-comment uppercase tracking-wider block ">
          GPA Hiện tại
        </span>
        <span className="text-4xl font-black text-tokyo-magenta mt-1 block">
          8.25
        </span>
        <div className="mt-2 h-1.5 bg-tokyo-storm rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-tokyo-magenta to-tokyo-blue w-[82%]" />
        </div>
      </div>
      {/* Reverse Calculator */}
      <div className="bg-tokyo-night rounded-xl p-4 border border-tokyo-border/40">
        <p className="text-[9px] text-tokyo-comment uppercase tracking-wider  mb-3">
          Tính ngược điểm cần đạt
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <span className="text-[8px] text-tokyo-fg block mb-1">
              GPA mục tiêu
            </span>
            <div className="bg-tokyo-storm rounded-lg px-3 py-2 border border-tokyo-border/40 text-sm  text-tokyo-magenta">
              8.50
            </div>
          </div>
          <div className="flex-1">
            <span className="text-[8px] text-tokyo-fg block mb-1">
              TC còn lại
            </span>
            <div className="bg-tokyo-storm rounded-lg px-3 py-2 border border-tokyo-border/40 text-sm  text-tokyo-fg">
              85
            </div>
          </div>
        </div>
        <div className="mt-3 bg-tokyo-green/10 border border-tokyo-green/20 rounded-lg p-3 text-center">
          <span className="text-[8px] text-tokyo-fg block">
            Điểm TB cần đạt
          </span>
          <span className="text-2xl font-black text-tokyo-green">8.73</span>
        </div>
      </div>
    </div>
  );
}

function SchedulerMockup() {
  const days = ["T2", "T3", "T4", "T5", "T6"];
  const blocks = [
    { day: 0, row: 0, label: "DSA", color: "var(--color-blue)" },
    { day: 1, row: 1, label: "OOP", color: "var(--color-teal)" },
    { day: 2, row: 0, label: "CSDL", color: "var(--color-magenta)" },
    { day: 3, row: 1, label: "HDH", color: "var(--color-orange)" },
    { day: 4, row: 0, label: "XSTK", color: "var(--color-red)" },
  ];
  return (
    <div className="space-y-3">
      {/* Upload hint */}
      <div className="bg-tokyo-night rounded-xl p-3 border border-tokyo-blue/20 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-tokyo-blue/10 border border-tokyo-blue/20 flex items-center justify-center shrink-0">
          <Upload className="w-4 h-4 text-tokyo-blue" />
        </div>
        <div>
          <p className="text-xs font-bold text-tokyo-variable">
            Upload TKB Excel
          </p>
          <p className="text-[9px] text-tokyo-comment">
            Tải lên file .xlsx để bắt đầu
          </p>
        </div>
      </div>
      {/* Timetable grid */}
      <div className="bg-tokyo-night rounded-xl p-3 border border-tokyo-border/40">
        <div className="grid grid-cols-6 gap-1 text-center text-[8px]">
          <div className="text-tokyo-comment font-bold py-1">Ca</div>
          {days.map((d) => (
            <div key={d} className="text-tokyo-variable font-bold py-1">
              {d}
            </div>
          ))}

          <div className="text-tokyo-comment py-2 bg-tokyo-storm/30 rounded">
            Sáng
          </div>
          {days.map((_, i) => {
            const block = blocks.find((b) => b.day === i && b.row === 0);
            return (
              <div key={`m${i}`} className="py-1">
                {block ? (
                  <div
                    className="rounded-lg p-2 font-bold h-full flex items-center justify-center text-[9px]"
                    style={{
                      backgroundColor: `${block.color}20`,
                      color: block.color,
                      border: `1px solid ${block.color}40`,
                    }}
                  >
                    {block.label}
                  </div>
                ) : (
                  <div className="h-full rounded-lg bg-tokyo-storm/20 min-h-[28px]" />
                )}
              </div>
            );
          })}

          <div className="text-tokyo-comment py-2 bg-tokyo-storm/30 rounded">
            Chiều
          </div>
          {days.map((_, i) => {
            const block = blocks.find((b) => b.day === i && b.row === 1);
            return (
              <div key={`a${i}`} className="py-1">
                {block ? (
                  <div
                    className="rounded-lg p-2 font-bold h-full flex items-center justify-center text-[9px]"
                    style={{
                      backgroundColor: `${block.color}20`,
                      color: block.color,
                      border: `1px solid ${block.color}40`,
                    }}
                  >
                    {block.label}
                  </div>
                ) : (
                  <div className="h-full rounded-lg bg-tokyo-storm/20 min-h-[28px]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Result badge */}
      <div className="flex items-center justify-between bg-tokyo-night rounded-xl p-3 border border-tokyo-green/20">
        <span className="text-[9px] text-tokyo-fg ">Phương án tối ưu #1</span>
        <span className="text-[9px] font-bold text-tokyo-green bg-tokyo-green/10 px-2 py-0.5 rounded">
          0 xung đột
        </span>
      </div>
    </div>
  );
}

function AiMateMockup() {
  return (
    <div className="space-y-3">
      {/* Chat header */}
      <div className="bg-tokyo-night rounded-xl p-3 border border-tokyo-teal/20 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-tokyo-teal to-tokyo-cyan flex items-center justify-center">
          <Image
            src="/ai.png"
            alt="AI Icon"
            width={20}
            height={20}
            className="object-contain"
          />
        </div>
        <div>
          <p className="text-xs font-bold text-tokyo-fg">UIT Mate</p>
          <p className="text-[9px] text-tokyo-teal flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-tokyo-teal inline-block" />
            Online
          </p>
        </div>
      </div>
      {/* Chat messages */}
      <div className="space-y-2">
        <div className="flex justify-start">
          <div className="max-w-[85%] bg-tokyo-night border border-tokyo-border/40 rounded-2xl rounded-bl-sm p-3 text-[11px] text-tokyo-variable leading-relaxed">
            Điều kiện nhận đồ án tốt nghiệp: tối thiểu{" "}
            <strong>110 tín chỉ</strong>, GPA từ <strong>5.0</strong> trở lên và
            không bị kỷ luật.
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] bg-tokyo-teal text-tokyo-night font-semibold rounded-2xl rounded-br-sm p-3 text-[11px] dark:text-tokyo-night">
            Học cải thiện có giới hạn không?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[85%] bg-tokyo-night border border-tokyo-border/40 rounded-2xl rounded-bl-sm p-3 text-[11px] text-tokyo-variable leading-relaxed">
            UIT <strong>không giới hạn</strong> số lần học cải thiện. Điểm cao
            nhất sẽ được ghi nhận.
          </div>
        </div>
      </div>
      {/* Suggested questions */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[9px] text-tokyo-cyan bg-tokyo-storm border border-tokyo-blue/20 px-2 py-1 rounded-lg">
          Điều kiện tốt nghiệp?
        </span>
        <span className="text-[9px] text-tokyo-cyan bg-tokyo-storm border border-tokyo-blue/20 px-2 py-1 rounded-lg">
          Quy chế học phí?
        </span>
      </div>
    </div>
  );
}

const SLIDE_MOCKUPS: Record<string, () => ReactNode> = {
  tracker: TrackerMockup,
  "gpa-tools": GpaToolsMockup,
  scheduler: SchedulerMockup,
  "ai-mate": AiMateMockup,
};

const AUTOPLAY_INTERVAL = 6000;

export default function HomePage() {
  const [me, setMe] = useState<{ student_code_masked: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Feature walkthrough carousel
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll reveal refs
  const heroReveal = useScrollReveal();
  const walkthroughReveal = useScrollReveal();
  const catalogReveal = useScrollReveal();

  useEffect(() => {
    apiFetch("/api/v1/me")
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        setMe(data);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Auto-play carousel
  useEffect(() => {
    if (isPaused) return;
    const tickInterval = 50;
    const totalTicks = AUTOPLAY_INTERVAL / tickInterval;
    let tick = 0;

    intervalRef.current = setInterval(() => {
      tick++;
      setSlideProgress((tick / totalTicks) * 100);
      if (tick >= totalTicks) {
        tick = 0;
        setSlideProgress(0);
        setActiveSlide((prev) => (prev + 1) % FEATURE_SLIDES.length);
      }
    }, tickInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, activeSlide]);

  const goToSlide = useCallback((idx: number) => {
    setActiveSlide(idx);
    setSlideProgress(0);
  }, []);

  const currentSlide = FEATURE_SLIDES[activeSlide];
  const MockupComponent = SLIDE_MOCKUPS[currentSlide.id];

  return (
    <main className="relative min-h-screen bg-[#1a1b26] text-[#a9b1d6] overflow-x-hidden font-sans pb-16">
      {/* Animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes float-slow {
            0%, 100% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-20px) scale(1.05); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(32px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.95) translateY(16px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes slideContent {
            from { opacity: 0; transform: translateX(24px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .anim-float {
            animation: float-slow 8s infinite ease-in-out;
          }
          .anim-float-delayed {
            animation: float-slow 10s infinite ease-in-out;
            animation-delay: 2s;
          }
          .scroll-reveal {
            opacity: 0;
            transform: translateY(32px);
            transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .scroll-reveal.visible {
            opacity: 1;
            transform: translateY(0);
          }
          .scroll-reveal-scale {
            opacity: 0;
            transform: scale(0.95) translateY(16px);
            transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .scroll-reveal-scale.visible {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          .slide-content-enter {
            animation: slideContent 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .hero-gradient-text {
            background-size: 200% 200%;
            animation: gradientShift 6s ease-in-out infinite;
          }
          .shimmer-line {
            background: linear-gradient(90deg, transparent 0%, rgba(122,162,247,0.08) 50%, transparent 100%);
            background-size: 200% 100%;
            animation: shimmer 3s infinite;
          }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #1a1b26; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #414868; border-radius: 2px; }
          .entrance-stagger > * {
            opacity: 0;
            animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .entrance-stagger > *:nth-child(1) { animation-delay: 0ms; }
          .entrance-stagger > *:nth-child(2) { animation-delay: 80ms; }
          .entrance-stagger > *:nth-child(3) { animation-delay: 160ms; }
          .entrance-stagger > *:nth-child(4) { animation-delay: 240ms; }
          .entrance-stagger > *:nth-child(5) { animation-delay: 320ms; }
          @media (prefers-reduced-motion: reduce) {
            .anim-float, .anim-float-delayed { animation: none; }
            .scroll-reveal, .scroll-reveal-scale { opacity: 1; transform: none; transition: none; }
            .slide-content-enter { animation: none; opacity: 1; }
            .hero-gradient-text { animation: none; }
            .shimmer-line { animation: none; }
            .entrance-stagger > * { opacity: 1; animation: none; }
          }
        `,
        }}
      />

      {/* Decorative Orbs */}
      <div className="absolute top-[10%] left-[5%] w-[350px] h-[350px] bg-[#bb9af7]/10 rounded-full blur-[100px] pointer-events-none anim-float" />
      <div className="absolute top-[40%] right-[5%] w-[400px] h-[400px] bg-[#7aa2f7]/10 rounded-full blur-[120px] pointer-events-none anim-float-delayed" />
      <div className="absolute bottom-[10%] left-[20%] w-[300px] h-[300px] bg-[#f7768e]/5 rounded-full blur-[90px] pointer-events-none anim-float" />

      {/* Grid Overlay */}
      <div className="dark:absolute inset-0 bg-[linear-gradient(to_right,#24283b_1px,transparent_1px),linear-gradient(to_bottom,#24283b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_88%)] opacity-35 pointer-events-none" />

      {/* Navigation Header */}
      <nav className="relative mx-auto max-w-6xl px-6 py-5 flex justify-between items-center   bg-transparent z-50 entrance-stagger">
        <div className="flex items-center gap-3 sm:gap-4 select-none group cursor-default">
          <div className="flex flex-col justify-center">
            <span className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-all duration-500">
              UIT{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7dcfff] to-[#7aa2f7] drop-shadow-[0_0_15px_rgba(125,207,255,0.3)] group-hover:drop-shadow-[0_0_20px_rgba(125,207,255,0.6)]">
                EduAdvisor
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {loading ? (
            <div className="h-7 w-24 animate-pulse rounded-md bg-[#24283b]" />
          ) : me ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px]  text-[#565f89]">
                {me.student_code_masked}
              </span>
              <Link
                href="/tracker"
                className="relative group inline-flex items-center gap-1 text-[11px]  font-bold px-3 py-1.5 rounded-md border border-[#7aa2f7]/40 bg-[#7aa2f7]/10 text-[#7aa2f7] overflow-hidden transition-all duration-300 hover:bg-[#7aa2f7]/20 shadow-[0_0_10px_rgba(122,162,247,0.1)] hover:shadow-[0_0_15px_rgba(122,162,247,0.25)]"
              >
                <span>ENTER SUITE</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          ) : (
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-1.5 text-[11px]  font-bold px-3 py-1.5 rounded-md border border-[#73daca]/40 bg-[#73daca]/10 text-[#73daca] transition-all duration-300 hover:bg-[#73daca]/20 hover:shadow-[0_0_15px_rgba(115,218,202,0.25)]"
            >
              <span>CONNECT DAA</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section
        ref={heroReveal.ref}
        className={`relative max-w-6xl mx-auto px-6 pt-16 md:pt-24 pb-12 text-center scroll-reveal ${heroReveal.isVisible ? "visible" : ""}`}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#bb9af7]/20 bg-[#bb9af7]/5 text-xs text-[#bb9af7] mb-6  font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI POWERED ACADEMIC ENGINE</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-none text-white max-w-4xl mx-auto">
          Cố vấn Học vụ Thông minh
          <span className="block mt-3 bg-gradient-to-r from-[#7aa2f7] via-[#bb9af7] to-[#f7768e] bg-clip-text text-transparent hero-gradient-text">
            Thiết kế dành cho UIT-ers
          </span>
        </h1>

        <p className="mt-6 text-sm sm:text-base text-[#9aa5ce] max-w-2xl mx-auto leading-relaxed">
          Đồng hành cùng sinh viên Trường Đại học Công nghệ Thông tin. Theo dõi
          trực quan lộ trình đào tạo, giả lập điểm số GPA (Hệ 10) và tra cứu
          nhanh quy chế đào tạo với trợ lý AI.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link
            href={me ? "/tracker" : "/onboarding"}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold text-[#1a1b26] bg-[#7aa2f7] rounded-xl hover:bg-[#7dcfff] shadow-[0_4px_20px_rgba(122,162,247,0.3)] transition-all duration-300 hover:-translate-y-0.5 group"
          >
            <span>Bắt đầu</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Animated Feature Walkthrough */}
      <section
        ref={walkthroughReveal.ref}
        className={`relative max-w-5xl mx-auto px-6 py-8 scroll-reveal-scale ${walkthroughReveal.isVisible ? "visible" : ""}`}
      >
        {/* Section header */}
        <div className="text-center mb-8">
          <span className="text-xs  font-bold uppercase tracking-widest text-[#7dcfff]">
            FEATURE WALKTHROUGH
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
            Khám phá từng công cụ
          </h2>
        </div>

        <div
          className="bg-[#24283b]/50 rounded-3xl border border-[#414868]/50 shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden backdrop-blur-sm"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Slide navigation dots + progress */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#414868]/40 bg-[#1a1b26]/60">
            <div className="flex items-center gap-2">
              {FEATURE_SLIDES.map((slide, idx) => {
                const SlideIcon = slide.icon;
                return (
                  <button
                    key={slide.id}
                    onClick={() => goToSlide(idx)}
                    className={`flex items-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 overflow-hidden whitespace-nowrap ${
                      idx === activeSlide
                        ? "bg-[#24283b] shadow-sm px-3 max-w-[200px]"
                        : "text-[#565f89] hover:text-[#9aa5ce] px-2 max-w-[40px]"
                    }`}
                    style={
                      idx === activeSlide ? { color: slide.accent } : undefined
                    }
                  >
                    <SlideIcon className="w-3.5 h-3.5 shrink-0" />
                    <span
                      className={`transition-opacity duration-300 ${idx === activeSlide ? "opacity-100" : "opacity-0 w-0"}`}
                    >
                      {slide.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Prev/Next */}
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  goToSlide(
                    (activeSlide - 1 + FEATURE_SLIDES.length) %
                      FEATURE_SLIDES.length,
                  )
                }
                className="p-1.5 rounded-lg text-[#565f89] hover:text-[#c0caf5] hover:bg-[#24283b] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  goToSlide((activeSlide + 1) % FEATURE_SLIDES.length)
                }
                className="p-1.5 rounded-lg text-[#565f89] hover:text-[#c0caf5] hover:bg-[#24283b] transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-[#1a1b26]">
            <div
              className="h-full transition-[width] duration-75 ease-linear"
              style={{
                width: `${slideProgress}%`,
                backgroundColor: currentSlide.accent,
              }}
            />
          </div>

          {/* Slide content */}
          <div className="p-6 md:p-8">
            <div
              key={currentSlide.id}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start slide-content-enter"
            >
              {/* Left: description + CTA */}
              <div className="flex flex-col justify-center space-y-5 order-2 lg:order-1">
                <div>
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px]  font-bold uppercase tracking-wider mb-4"
                    style={{
                      color: currentSlide.accent,
                      backgroundColor: currentSlide.accentBg,
                      border: `1px solid ${currentSlide.accentBorder}`,
                    }}
                  >
                    <currentSlide.icon className="w-3 h-3" />
                    {currentSlide.subtitle}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                    {currentSlide.title}
                  </h3>
                  <p className="mt-3 text-sm text-[#9aa5ce] leading-relaxed max-w-md">
                    {currentSlide.description}
                  </p>
                </div>

                <Link
                  href={me ? currentSlide.href : "/onboarding"}
                  className="inline-flex items-center gap-2 text-sm font-bold rounded-xl px-6 py-2.5 transition-all duration-300 hover:-translate-y-0.5 group w-fit"
                  style={{
                    color: "#4c4f69",
                    backgroundColor: currentSlide.accent,
                    boxShadow: `0 4px 20px ${currentSlide.accentBorder}`,
                  }}
                >
                  <span>Dùng thử</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                {/* Slide counter */}
                <span className="text-[10px]  text-[#565f89]">
                  {String(activeSlide + 1).padStart(2, "0")} /{" "}
                  {String(FEATURE_SLIDES.length).padStart(2, "0")}
                </span>
              </div>

              {/* Right: visual mockup */}
              <div className="order-1 lg:order-2">
                <div
                  className="rounded-2xl border p-5 bg-[#24283b]/60 backdrop-blur-sm transition-colors duration-500"
                  style={{ borderColor: currentSlide.accentBorder }}
                >
                  {/* Mockup header bar */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#f7768e]/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#e0af68]/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#9ece6a]/60" />
                    <div className="flex-1 ml-3">
                      <div className="h-6 bg-tokyo-panel/80 dark:bg-tokyo-night border border-tokyo-border/50 rounded-md flex items-center px-2 shadow-sm">
                        <Lock className="w-3 h-3 text-tokyo-comment mr-1.5" />
                        <span className="text-[10px] text-tokyo-comment tracking-wide">
                          eduadvisor.uit.dev<span className="text-tokyo-fg">{currentSlide.href}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <MockupComponent />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Navigation Cards Grid */}
      <section
        ref={catalogReveal.ref}
        className={`relative max-w-6xl mx-auto px-6 py-16 md:py-24 border-t border-[#414868]/30 scroll-reveal ${catalogReveal.isVisible ? "visible" : ""}`}
        style={{ transitionDelay: "100ms" }}
      >
        <div className="flex flex-col items-center space-y-4 mb-14 text-center">
          <span className="text-xs  font-bold uppercase tracking-widest text-[#7dcfff]">
            MODULE SUITE CATALOG
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">
            Bộ công cụ hỗ trợ học tập toàn diện
          </h2>
          <p className="text-sm text-[#9aa5ce] max-w-xl leading-relaxed">
            Tối ưu hóa hiệu suất học tập, lên kế hoạch thông minh và giải phóng
            thời gian biểu của bạn với các mô đun chuyên nghiệp.
          </p>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 ${catalogReveal.isVisible ? "entrance-stagger" : ""}`}
        >
          <FeatureCard
            href="/ai-mate"
            title="UIT Mate"
            description="Trò chuyện trực tiếp cùng trợ lý AI được thiết kế chuyên sâu cho quy chế học tập, quy định tín chỉ tại UIT."
            icon={MessageSquare}
            colorClass="text-[#bb9af7] group-hover:text-[#c0caf5]"
            badgeText="GPT Core"
          />
          <FeatureCard
            href="/tracker"
            title="Academic Tracker"
            description="Theo dõi lộ trình đào tạo, kiểm soát tiến trình tích lũy học phần và hiển thị điểm số chi tiết cho từng học kỳ."
            icon={GraduationCap}
            colorClass="text-[#7aa2f7] group-hover:text-[#c0caf5]"
            badgeText="Standard"
          />
          <FeatureCard
            href="/gpa-tools"
            title="GPA Tools"
            description="Lập kế hoạch giả lập điểm số mục tiêu, tối ưu hóa điểm các học phần cần cải thiện để tối ưu GPA học kỳ."
            icon={Calculator}
            colorClass="text-[#ff9e64] group-hover:text-[#c0caf5]"
            badgeText="Advanced"
          />
          <FeatureCard
            href="/scheduler"
            title="UIT Scheduler"
            description="Tự động hóa lập thời khóa biểu tối ưu, hiển thị lịch thi, nhắc hạn nộp bài tập lớn và tránh lịch học trùng lặp."
            icon={Calendar}
            colorClass="text-[#f7768e] group-hover:text-[#c0caf5]"
            badgeText="Automation"
          />
          <FeatureCard
            href="/settings"
            title="Cài đặt Suite"
            description="Quản lý kênh thông báo đa nền tảng, tùy chỉnh thời gian nhắc lịch học/thi và kiểm soát dữ liệu tài khoản."
            icon={Settings}
            colorClass="text-[#9aa5ce] group-hover:text-[#c0caf5]"
          />
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="relative max-w-6xl mx-auto px-6 pt-8 border-t border-[#414868]/30 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px]  text-[#565f89] uppercase tracking-widest">
        <span>&copy; 2026 UIT EduAdvisor Platform</span>
      </footer>
    </main>
  );
}

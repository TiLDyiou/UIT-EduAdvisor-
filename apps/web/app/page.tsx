"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface FeatureCardProps {
  href: string;
  title: string;
  category: string;
  description: string;
  techSpec: string;
  theme: "cyan" | "violet" | "emerald" | "amber" | "neutral" | "rose";
}

function FeatureCard({ href, title, category, description, techSpec, theme }: FeatureCardProps) {
  const themeClasses = {
    cyan: {
      border: "border-cyan-500/20 hover:border-cyan-400/80",
      text: "text-cyan-400",
      stripe: "bg-cyan-400",
      tag: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    },
    violet: {
      border: "border-violet-500/20 hover:border-violet-400/80",
      text: "text-violet-400",
      stripe: "bg-violet-400",
      tag: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    },
    emerald: {
      border: "border-emerald-500/20 hover:border-emerald-400/80",
      text: "text-emerald-400",
      stripe: "bg-emerald-400",
      tag: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    amber: {
      border: "border-amber-500/20 hover:border-amber-400/80",
      text: "text-amber-400",
      stripe: "bg-amber-400",
      tag: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    neutral: {
      border: "border-zinc-700/40 hover:border-zinc-400",
      text: "text-zinc-300",
      stripe: "bg-zinc-400",
      tag: "bg-zinc-800 text-zinc-400 border-zinc-700/40",
    },
    rose: {
      border: "border-rose-500/20 hover:border-rose-400/80",
      text: "text-rose-400",
      stripe: "bg-rose-400",
      tag: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    },
  };

  const currentTheme = themeClasses[theme];

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-[4px] border bg-[#1b1b20]/40 p-6 backdrop-blur-md transition-all duration-300 ${currentTheme.border}`}
    >
      {/* Cạnh chỉ thị màu bên trái (Stripe) */}
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-300 ${currentTheme.stripe}`} />

      <div className="flex flex-col h-full justify-between gap-5">
        <div>
          <div className="flex items-center justify-between">
            <span className={`rounded-[2px] border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${currentTheme.tag}`}>
              {category}
            </span>
          </div>

          <h3 className="mt-4 text-base font-bold tracking-tight text-[#e4e1e9] group-hover:text-white transition-colors duration-200">
            {title}
          </h3>

          <p className="mt-2 text-xs leading-relaxed text-[#b9cacb] group-hover:text-[#e4e1e9] transition-colors duration-200">
            {description}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-[#3a494b]/20 pt-3 text-[9px] font-mono text-[#849495]">
          <span>SPEC: {techSpec}</span>
          <span className="flex items-center gap-1 transition-all duration-200 group-hover:text-white group-hover:translate-x-0.5">
            CHẠY &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [me, setMe] = useState<{ student_code_masked: string } | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="relative min-h-screen bg-[#131318] text-[#e4e1e9] overflow-hidden px-4 py-8 md:px-8 md:py-16 flex flex-col justify-between">
      {/* Nền lưới tối giản (Grid Canvas) */}
      <div className="absolute inset-0 bg-[radial-gradient(#3a494b_0.5px,transparent_0.5px)] [background-size:32px_32px] opacity-10 pointer-events-none" />

      {/* Header tối giản */}
      <div className="relative mx-auto w-full max-w-6xl flex justify-between items-center border-b border-[#3a494b]/20 pb-4 mb-12">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-[#00ff92] animate-pulse" />
          <span className="text-[10px] font-mono tracking-widest text-[#849495] font-semibold uppercase">
            UIT.EDUADVISOR
          </span>
        </div>
        <div>
          {loading ? (
            <div className="h-6 w-20 animate-pulse rounded-[4px] bg-[#35343a]" />
          ) : me ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-[#849495]">
                {me.student_code_masked}
              </span>
              <Link
                href="/tracker"
                className="rounded-[4px] border border-[#00dbe7]/30 bg-[#00dbe7]/10 px-3 py-1 text-xs font-semibold text-[#00dbe7] transition-all duration-200 hover:bg-[#00dbe7]/20"
              >
                VÀO SUITE
              </Link>
            </div>
          ) : (
            <Link
              href="/onboarding"
              className="rounded-[4px] border border-[#00dbe7]/30 bg-[#00dbe7]/10 px-3 py-1 text-xs font-semibold text-[#00dbe7] transition-all duration-200 hover:bg-[#00dbe7]/20"
            >
              ĐĂNG NHẬP
            </Link>
          )}
        </div>
      </div>

      {/* Hero Section căn giữa tinh tế & tối giản */}
      <div className="relative mx-auto w-full max-w-3xl text-center space-y-6 my-12">
        <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#00dbe7] font-bold">
          ALL-IN-ONE ACADEMIC CORE SUITE
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight font-sans">
          Cố vấn Học vụ
          <span className="block sm:inline sm:ml-3 bg-gradient-to-r from-[#00dbe7] via-[#7000ff] to-[#00ff92] bg-clip-text text-transparent">
            Thông minh UIT
          </span>
        </h1>
        <p className="text-xs sm:text-sm leading-relaxed text-[#b9cacb] max-w-xl mx-auto">
          Người bạn đồng hành hỗ trợ sinh viên UIT theo dõi lộ trình học tập, tự động tính toán GPA mục tiêu và tra cứu quy chế đào tạo tức thời bằng trí tuệ nhân tạo Gemini.
        </p>

        {/* Nút hành động nhanh */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {me ? (
            <Link
              href="/tracker"
              className="rounded-[4px] bg-[#00dbe7] text-[#0e0e13] px-5 py-2 text-xs font-bold transition-all duration-200 hover:bg-[#00c5d0] hover:shadow-[0_0_12px_rgba(0,219,231,0.2)]"
            >
              Xem lộ trình học tập
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="rounded-[4px] bg-[#00dbe7] text-[#0e0e13] px-5 py-2 text-xs font-bold transition-all duration-200 hover:bg-[#00c5d0] hover:shadow-[0_0_12px_rgba(0,219,231,0.2)]"
            >
              Bắt đầu ngay
            </Link>
          )}
          <Link
            href="/ai-mate"
            className="rounded-[4px] border border-[#3a494b] text-[#e4e1e9] px-5 py-2 text-xs font-semibold transition-all duration-200 hover:border-[#849495]"
          >
            Hỏi đáp AI Cố vấn
          </Link>
        </div>
      </div>

      {/* Grid danh sách chức năng (Hoàn toàn Responsive) */}
      <div className="relative mx-auto w-full max-w-6xl space-y-6 mt-16 mb-8">
        <div className="flex items-center gap-3">
          <h2 className="text-[9px] font-mono tracking-widest text-[#849495] uppercase font-bold">
            DANH MỤC CÔNG CỤ
          </h2>
          <div className="h-px flex-1 bg-[#3a494b]/20" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <FeatureCard
            href="/ai-mate"
            category="AI Assistant"
            title="AI Mate Cố vấn"
            description="Trò chuyện trực tiếp cùng trợ lý AI được huấn luyện chuyên sâu để giải đáp các điều kiện và quy chế đào tạo tại UIT."
            techSpec="Gemini-2.0-Flash / RAG"
            theme="emerald"
          />
          <FeatureCard
            href="/tracker"
            category="Roadmap & GPA"
            title="Academic Tracker"
            description="Theo dõi chương trình đào tạo, kiểm soát lộ trình môn học học kỳ tiếp theo và tính toán GPA trực quan."
            techSpec="Graph Engine / Live GPA"
            theme="violet"
          />
          <FeatureCard
            href="/tracker/gpa-tools"
            category="Analytics"
            title="GPA Tools Suite"
            description="Bộ công cụ thông minh tính điểm học phần, dự toán điểm số mục tiêu và tối ưu hóa lộ trình cải thiện GPA."
            techSpec="Precise Decimal128"
            theme="amber"
          />
          <FeatureCard
            href="/scheduler"
            category="Schedule"
            title="UIT Scheduler"
            description="Tự động sắp xếp thời khóa biểu và lịch thi thông minh, tránh trùng lặp môn học và tối ưu hóa lịch biểu."
            techSpec="Constraint Solver / DAA"
            theme="rose"
          />
          <FeatureCard
            href="/settings"
            category="Configuration"
            title="Cài đặt hệ thống"
            description="Thiết lập cấu hình tài khoản, quản lý dữ liệu cá nhân và cấu hình các thông số kết nối của hệ thống."
            techSpec="Local Encryption / Sync"
            theme="neutral"
          />
        </div>
      </div>

      {/* Footer chân trang tối giản */}
      <div className="relative mx-auto w-full max-w-6xl border-t border-[#3a494b]/20 pt-6 mt-12 flex flex-col sm:flex-row justify-between items-center gap-3 text-[9px] font-mono text-[#849495] uppercase tracking-wider">
        <span>© 2026 UIT EduAdvisor Platform</span>
        <span>Version 0.1.0 // Production Node</span>
      </div>
    </main>
  );
}

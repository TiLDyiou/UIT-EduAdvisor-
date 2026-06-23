"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

import { MessageSquare, GraduationCap, Calculator, Calendar, Settings } from "lucide-react";

interface FeatureCardProps {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  theme: "cyan" | "violet" | "emerald" | "amber" | "neutral" | "rose";
}

function FeatureCard({ href, title, description, icon: Icon, theme }: FeatureCardProps) {
  const themeClasses = {
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    neutral: "bg-zinc-800 text-zinc-400 border-zinc-700/40",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  const iconTheme = themeClasses[theme];

  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-start px-5 space-y-4 group"
    >
      <div className={`flex items-center justify-center w-16 h-16 rounded-full border transition-all duration-300 group-hover:scale-110 ${iconTheme}`}>
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors duration-200 text-center">
        {title}
      </h3>
      <p className="text-center text-sm text-[#b9cacb] leading-relaxed">
        {description}
      </p>
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

      {/* Hero Section */}
      <div className="w-full py-10 md:py-20">
        <div className="flex flex-col items-center justify-center pt-10 mx-auto max-w-4xl text-center space-y-6">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight">
            <span className="block text-white">Cố vấn Học vụ</span>
            <span className="block mt-2 bg-gradient-to-r from-[#00dbe7] via-[#7000ff] to-[#00ff92] bg-clip-text text-transparent">
              Thông minh UIT
            </span>
          </h1>
          <p className="mt-5 text-center text-[#b9cacb] text-base md:text-lg max-w-2xl">
            Đồng hành cùng sinh viên UIT. Theo dõi lộ trình học tập, tính toán GPA và tra cứu quy chế đào tạo tức thời bằng trí tuệ nhân tạo Gemini.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-5 mt-10">
          {me ? (
            <Link
              href="/tracker"
              className="px-10 py-3 text-center text-[#0e0e13] font-bold bg-[#00dbe7] rounded shadow hover:bg-[#00c5d0] hover:shadow-[0_0_15px_rgba(0,219,231,0.4)] transition-all"
            >
              Xem lộ trình học tập
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="px-10 py-3 text-center text-[#0e0e13] font-bold bg-[#00dbe7] rounded shadow hover:bg-[#00c5d0] hover:shadow-[0_0_15px_rgba(0,219,231,0.4)] transition-all"
            >
              Bắt đầu ngay
            </Link>
          )}
          <Link
            href="/ai-mate"
            className="px-10 py-3 text-center text-white font-semibold rounded shadow border border-[#3a494b] hover:bg-[#1b1b20] transition-all"
          >
            Hỏi đáp AI Cố vấn
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="w-full py-10 md:py-20 border-t border-[#3a494b]/20">
        <div className="relative flex flex-col w-full max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col items-center space-y-4">
            <h6 className="font-bold text-center text-[#00dbe7] tracking-widest uppercase text-sm">
              Danh mục công cụ
            </h6>
            <h2 className="text-3xl md:text-4xl font-bold text-center text-white">
              <span className="block">Bộ công cụ hỗ trợ toàn diện</span>
            </h2>
            <p className="text-center text-[#b9cacb] max-w-2xl">
              Nâng cao hiệu suất học tập và lên kế hoạch tại trường với những tính năng chuyên sâu được thiết kế riêng cho sinh viên UIT.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-16 gap-x-8">
            <FeatureCard
              href="/ai-mate"
              title="AI Mate Cố vấn"
              description="Trò chuyện trực tiếp cùng trợ lý AI được huấn luyện chuyên sâu để giải đáp các điều kiện và quy chế đào tạo tại UIT."
              icon={MessageSquare}
              theme="emerald"
            />
            <FeatureCard
              href="/tracker"
              title="Academic Tracker"
              description="Theo dõi chương trình đào tạo, kiểm soát lộ trình môn học học kỳ tiếp theo và tính toán GPA trực quan."
              icon={GraduationCap}
              theme="violet"
            />
            <FeatureCard
              href="/gpa-tools"
              title="GPA Tools Suite"
              description="Bộ công cụ thông minh tính điểm học phần, dự toán điểm số mục tiêu và tối ưu hóa lộ trình cải thiện GPA."
              icon={Calculator}
              theme="amber"
            />
            <FeatureCard
              href="/scheduler"
              title="UIT Scheduler"
              description="Tự động sắp xếp thời khóa biểu và lịch thi thông minh, tránh trùng lặp môn học và tối ưu hóa lịch biểu."
              icon={Calendar}
              theme="rose"
            />
            <FeatureCard
              href="/settings"
              title="Cài đặt hệ thống"
              description="Thiết lập cấu hình tài khoản, quản lý dữ liệu cá nhân và cấu hình các thông số kết nối của hệ thống."
              icon={Settings}
              theme="neutral"
            />
          </div>
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

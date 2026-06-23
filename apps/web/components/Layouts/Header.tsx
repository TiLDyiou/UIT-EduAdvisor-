"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { User, Bell, Menu } from "lucide-react";

export function Header() {
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
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#3a494b]/20 bg-[#131318]/80 px-4 md:px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {/* Mobile menu button (placeholder for actual functionality) */}
        <button className="md:hidden text-[#b9cacb] hover:text-white">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#1b1b20] border border-[#3a494b]/40 text-[#849495] transition-colors hover:text-[#00dbe7] hover:border-[#00dbe7]/40">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-rose-500"></span>
        </button>

        <div className="h-6 w-px bg-[#3a494b]/40"></div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-6 w-20 animate-pulse rounded-[4px] bg-[#35343a]" />
          ) : me ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-mono font-medium text-[#e4e1e9]">
                  {me.student_code_masked}
                </p>
                <p className="text-[9px] font-mono text-[#849495] uppercase">
                  Sinh viên
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00dbe7]/10 border border-[#00dbe7]/30 text-[#00dbe7]">
                <User className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <Link
              href="/onboarding"
              className="rounded-[4px] border border-[#00dbe7]/30 bg-[#00dbe7]/10 px-4 py-1.5 text-xs font-semibold text-[#00dbe7] transition-all duration-200 hover:bg-[#00dbe7]/20"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

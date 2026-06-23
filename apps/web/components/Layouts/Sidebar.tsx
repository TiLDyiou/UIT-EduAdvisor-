"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Settings,
  Shield,
  GraduationCap,
  LogOut,
  Calculator,
} from "lucide-react";

const NAV_ITEMS = [
  {
    title: "Trang chủ",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Tracker & Roadmap",
    url: "/tracker",
    icon: GraduationCap,
  },
  {
    title: "GPA Tools",
    url: "/tracker/gpa-tools",
    icon: Calculator,
  },
  {
    title: "UIT Scheduler",
    url: "/scheduler",
    icon: Calendar,
  },
  {
    title: "AI Mate",
    url: "/ai-mate",
    icon: MessageSquare,
  },
  {
    title: "Cài đặt",
    url: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ student_code_masked?: string; csrf_token?: string } | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setMe(data))
      .catch(() => {});
  }, []);

  // Determine if the current user is a student (has student_code_masked)
  const isStudent = me && me.student_code_masked;

  const handleLogout = async () => {
    // Determine the logout endpoint and redirect path based on user role
    const isCurrentlyAdmin = pathname.startsWith("/admin");
    const endpoint = isCurrentlyAdmin ? "/api/v1/admin/auth/logout" : "/api/v1/auth/logout";
    
    try {
      await apiFetch(endpoint, {
        method: "POST",
        headers: me?.csrf_token ? { "X-CSRF-Token": me.csrf_token } : undefined,
      });
    } catch (e) {
      console.error("Logout failed", e);
    }
    
    router.replace(isCurrentlyAdmin ? "/admin/login" : "/onboarding");
  };

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-[260px] flex-col border-r border-[#3a494b]/20 bg-[#0e0e13] text-[#e4e1e9]">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[#3a494b]/20 px-6">
        <div className="h-2 w-2 rounded-full bg-[#00ff92] animate-pulse" />
        <span className="text-[11px] font-mono tracking-widest text-[#00dbe7] font-semibold uppercase">
          UIT.EDUADVISOR
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-4 text-[9px] font-mono tracking-wider text-[#849495] uppercase font-bold px-2">
          Hệ thống
        </div>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
            const Icon = item.icon;

            return (
              <li key={item.url}>
                <Link
                  href={item.url}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-[#00dbe7]/10 text-[#00dbe7] shadow-[inset_2px_0_0_#00dbe7]"
                      : "text-[#b9cacb] hover:bg-[#1b1b20] hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-[#00dbe7]" : "text-[#849495]"}`} />
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Quản trị viên */}
        {!isStudent && (
          <>
            <div className="mt-8 mb-4 text-[9px] font-mono tracking-wider text-[#849495] uppercase font-bold px-2">
              Quản trị
            </div>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/admin"
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    pathname.startsWith("/admin")
                      ? "bg-[#7000ff]/10 text-[#a366ff] shadow-[inset_2px_0_0_#7000ff]"
                      : "text-[#b9cacb] hover:bg-[#1b1b20] hover:text-white"
                  }`}
                >
                  <Shield className={`h-4 w-4 ${pathname.startsWith("/admin") ? "text-[#7000ff]" : "text-[#849495]"}`} />
                  Quản trị viên
                </Link>
              </li>
            </ul>
          </>
        )}
      </nav>

      <div className="border-t border-[#3a494b]/20 p-4">
        <button 
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[#b9cacb] hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-200"
        >
          <LogOut className="h-4 w-4 text-[#849495] group-hover:text-rose-400" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}

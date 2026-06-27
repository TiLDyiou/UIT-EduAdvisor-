"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Layouts/Sidebar";
import { UITMateWidget } from "@/components/UITMateWidget";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/tracker": "Dashboard",
  "/gpa-tools": "GPA Tools",
  "/scheduler": "UIT Scheduler",
  "/settings": "Cài đặt",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  // Find a matching title
  const currentTitle =
    ROUTE_LABELS[pathname] ||
    Object.entries(ROUTE_LABELS).find(
      ([route]) => route !== "/" && pathname.startsWith(route),
    )?.[1] ||
    "Trang chủ";

  return (
    <div className="flex min-h-screen bg-[#131318]">
      <div className="hidden md:block">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      <div
        className={`flex w-full flex-col transition-all duration-300 ${
          isCollapsed ? "md:pl-[64px]" : "md:pl-[260px]"
        }`}
      >
        {/* Minimal Breadcrumb Topbar matching the template */}
        <div className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#3a494b]/20 bg-[#131318]/80 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Collapse toggle button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3a494b]/40 bg-[#1b1b20] text-[#b9cacb] hover:text-white transition-colors focus:outline-none hidden md:flex"
              title="Toggle sidebar"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            {/* Breadcrumb */}
            <ol className="flex items-center whitespace-nowrap text-sm">
              <li className="flex items-center text-[#849495]">
                Tools
                <svg
                  className="mx-2 h-2.5 w-2.5 shrink-0 text-[#3a494b]"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M5 1L10.6869 7.16086C10.8637 7.35239 10.8637 7.64761 10.6869 7.83914L5 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </li>
              <li
                className="font-semibold text-[#e4e1e9] truncate"
                aria-current="page"
              >
                {currentTitle}
              </li>
            </ol>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>

        <main className="flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8 text-[#e4e1e9]">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      <UITMateWidget />
    </div>
  );
}

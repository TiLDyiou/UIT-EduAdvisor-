"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu, ChevronRight } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/courses": "Môn học",
  "/admin/curricula": "Chương trình đào tạo",
};

export function AdminHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  const currentLabel =
    ROUTE_LABELS[pathname] ||
    Object.entries(ROUTE_LABELS).find(
      ([route]) => route !== "/admin" && pathname.startsWith(route),
    )?.[1] ||
    "Admin";

  return (
    <header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between px-4 sm:px-6 backdrop-blur-md"
      style={{
        backgroundColor: "var(--admin-header-bg)",
        borderBottom: "1px solid var(--admin-header-border)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Toggle sidebar button (visible on both mobile and desktop) */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors cursor-pointer"
          style={{ color: "var(--admin-text-muted)" }}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <ol className="flex items-center text-sm">
          <li
            className="text-[13px]"
            style={{ color: "var(--admin-text-faint)" }}
          >
            Admin
          </li>
          <li>
            <ChevronRight
              className="mx-1.5 h-3.5 w-3.5"
              style={{ color: "var(--admin-text-faint)" }}
            />
          </li>
          <li
            className="text-[13px] font-semibold"
            style={{ color: "var(--admin-text)" }}
          >
            {currentLabel}
          </li>
        </ol>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}

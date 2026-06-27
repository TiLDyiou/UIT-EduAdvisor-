"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  LogOut,
  X,
  Shield,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const NAV_SECTIONS = [
  {
    label: "TỔNG QUAN",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "NỘI DUNG",
    items: [
      { href: "/admin/courses", label: "Môn học", icon: BookOpen },
      { href: "/admin/curricula", label: "CTĐT", icon: GraduationCap },
    ],
  },
];

export function AdminSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiFetch("/api/v1/admin/auth/logout", { method: "POST" });
    } catch {
      /* best-effort */
    }
    router.replace("/admin/login");
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleLinkClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onClose();
    }
  };

  const sidebarContent = (
    <div
      className="flex h-full w-[272px] flex-col admin-scrollbar"
      style={{
        backgroundColor: "var(--admin-sidebar-bg)",
        borderRight: "1px solid var(--admin-sidebar-border)",
      }}
    >
      {/* Logo */}
      <Link
        href="/admin"
        className="flex h-16 shrink-0 items-center gap-3 px-5 overflow-hidden transition-colors duration-200"
        style={{ borderBottom: "1px solid var(--admin-sidebar-border)" }}
        onClick={handleLinkClick}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg admin-active-accent">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <span
          className="text-[15px] font-bold tracking-tight whitespace-nowrap"
          style={{ color: "var(--admin-text)" }}
        >
          Admin Panel
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6 admin-scrollbar">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div
              className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--admin-text-faint)" }}
            >
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, (item as { exact?: boolean }).exact);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={handleLinkClick}
                      className={`admin-nav-item relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium ${active ? "active" : ""}`}
                      style={{
                        color: active
                          ? "var(--admin-accent-text)"
                          : "var(--admin-text-muted)",
                        backgroundColor: active
                          ? "var(--admin-accent-soft)"
                          : "transparent",
                      }}
                    >
                      {/* Gradient accent line for active item */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full admin-active-accent" />
                      )}
                      <Icon
                        className="h-[18px] w-[18px] shrink-0 transition-colors duration-200"
                        style={{
                          color: active
                            ? "var(--admin-accent)"
                            : "var(--admin-text-faint)",
                        }}
                      />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom: Logout */}
      <div
        className="shrink-0 p-3"
        style={{ borderTop: "1px solid var(--admin-sidebar-border)" }}
      >
        <button
          onClick={handleLogout}
          className="admin-nav-item admin-nav-danger flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium cursor-pointer"
          style={{ color: "var(--admin-text-muted)" }}
        >
          <LogOut
            className="h-[18px] w-[18px] shrink-0"
            style={{ color: "var(--admin-text-faint)" }}
          />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      {isOpen && (
        <aside className="hidden md:flex h-full shrink-0">{sidebarContent}</aside>
      )}

      {/* Mobile overlay — toggled */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <aside className="relative z-10 h-full admin-slide-in">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:opacity-70"
              style={{ color: "var(--admin-text-muted)" }}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

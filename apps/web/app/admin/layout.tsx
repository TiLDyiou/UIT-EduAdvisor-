"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import "./admin.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem("admin-sidebar-open");
    if (saved !== null) {
      setIsSidebarOpen(saved === "true");
    }
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-open", String(next));
      return next;
    });
  };

  const isLoginPage = pathname === "/admin/login";

  /* Login page renders full-screen without sidebar/header chrome */
  if (isLoginPage) {
    return (
      <div
        className="admin-layout fixed inset-0 z-[60] flex items-center justify-center"
        style={{ backgroundColor: "var(--admin-bg)" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="admin-layout fixed inset-0 z-[60] flex"
      style={{ backgroundColor: "var(--admin-bg)", color: "var(--admin-text)" }}
    >
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader
          onMenuClick={handleToggleSidebar}
        />

        <main
          className="flex-1 overflow-y-auto admin-scrollbar"
          style={{ backgroundColor: "var(--admin-bg)" }}
        >
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

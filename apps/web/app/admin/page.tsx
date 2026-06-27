"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchAdminMe, type AdminMe } from "@/lib/admin";
import {
  BookOpen,
  GraduationCap,
  ArrowRight,
} from "lucide-react";

const MODULES = [
  {
    href: "/admin/courses",
    icon: BookOpen,
    title: "Môn học",
    description:
      "Quản lý danh sách môn học, thông tin tín chỉ, và mối quan hệ tiên quyết giữa các môn.",
  },
  {
    href: "/admin/curricula",
    icon: GraduationCap,
    title: "Chương trình đào tạo",
    description:
      "Xây dựng và chỉnh sửa khung chương trình đào tạo theo từng chuyên ngành và năm học.",
  },
];

export default function AdminHomePage() {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchAdminMe();
      if (cancelled) return;
      if (r.unauthorized) {
        router.replace("/admin/login");
        return;
      }
      if (r.ok && r.me) setMe(r.me);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header */}
        <div
          className="h-28 rounded-2xl admin-shimmer"
          style={{
            backgroundColor: "var(--admin-surface)",
            border: "1px solid var(--admin-border)",
          }}
        />
        {/* Skeleton cards */}
        <div className="grid gap-4 sm:grid-cols-2 md:max-w-3xl">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl admin-shimmer"
              style={{
                backgroundColor: "var(--admin-surface)",
                border: "1px solid var(--admin-border)",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <header className="admin-fade-in">
        <div
          className="relative overflow-hidden rounded-2xl p-6 md:p-8"
          style={{
            backgroundColor: "var(--admin-surface)",
            border: "1px solid var(--admin-border)",
          }}
        >
          {/* Decorative gradient orb */}
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-[0.07] blur-xl"
            style={{
              background:
                "radial-gradient(circle, var(--admin-accent) 0%, transparent 70%)",
            }}
          />
          <div
            className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full opacity-[0.04] blur-2xl"
            style={{
              background:
                "radial-gradient(circle, var(--admin-accent-2) 0%, transparent 70%)",
            }}
          />

          <p
            className="text-xs font-semibold uppercase tracking-[0.15em] mb-1"
            style={{ color: "var(--admin-accent)" }}
          >
            UIT EduAdvisor
          </p>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--admin-text)" }}
          >
            Admin Dashboard
          </h1>
          <p
            className="mt-1.5 text-sm"
            style={{ color: "var(--admin-text-muted)" }}
          >
            Đăng nhập với{" "}
            <span
              className="font-medium"
              style={{ color: "var(--admin-accent-text)" }}
            >
              {me.email}
            </span>
          </p>
        </div>
      </header>

      {/* Module Cards */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 md:max-w-3xl">
          {MODULES.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="admin-card admin-fade-in group relative flex flex-col gap-3 rounded-xl p-5"
                style={{
                  backgroundColor: "var(--admin-surface)",
                  border: "1px solid var(--admin-border)",
                  animationDelay: `${80 + i * 50}ms`,
                }}
              >
                {/* Icon */}
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: "var(--admin-accent-soft)" }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: "var(--admin-accent)" }}
                  />
                </div>

                {/* Text */}
                <div className="flex-1">
                  <span
                    className="text-[14px] font-semibold block"
                    style={{ color: "var(--admin-text)" }}
                  >
                    {mod.title}
                  </span>
                  <p
                    className="mt-1 text-xs leading-relaxed"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    {mod.description}
                  </p>
                </div>

                {/* Arrow indicator */}
                <ArrowRight
                  className="h-4 w-4 transition-all duration-300 opacity-0 translate-x-0 group-hover:opacity-100 group-hover:translate-x-1"
                  style={{ color: "var(--admin-accent)" }}
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

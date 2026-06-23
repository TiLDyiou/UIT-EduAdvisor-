"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { fetchAdminMe, type AdminMe } from "@/lib/admin";
import { apiFetch } from "@/lib/api";

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
      if (r.ok && r.me) {
        setMe(r.me);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-400">Đang tải…</p>
      </main>
    );
  }
  if (!me) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">UIT EduAdvisor</p>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-neutral-400">Đăng nhập với {me.email}</p>
        </div>
      </header>
      <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 text-sm text-neutral-300">
        <p className="mb-6 text-base">Đăng nhập thành công. Chọn phân hệ quản lý để thao tác:</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link className="flex flex-col gap-2 rounded border border-neutral-700 p-4 hover:border-cyan-500" href="/admin/curricula">
            <span className="font-medium text-cyan-400">Chương trình đào tạo</span>
            <span className="text-xs text-neutral-400">Quản lý các khung chương trình đào tạo theo từng chuyên ngành và năm học. Cung cấp dữ liệu gốc để tư vấn môn học cho sinh viên.</span>
          </Link>
          <Link className="flex flex-col gap-2 rounded border border-neutral-700 p-4 hover:border-cyan-500" href="/admin/policies">
            <span className="font-medium text-cyan-400">Quy chế & Chính sách</span>
            <span className="text-xs text-neutral-400">Tải lên (Upload) file tài liệu quy chế (PDF, Docx) để AI phân tích (Ingest) và học kiến thức, dùng để trả lời tự động các câu hỏi của sinh viên.</span>
          </Link>
          <Link className="flex flex-col gap-2 rounded border border-neutral-700 p-4 hover:border-cyan-500" href="/admin/imports">
            <span className="font-medium text-cyan-400">Nhập dữ liệu Excel</span>
            <span className="text-xs text-neutral-400">Tải lên các file Excel như Lịch thi, Danh sách mở lớp. Hệ thống sẽ kiểm tra trước (Preview) và cho phép bạn áp dụng (Apply) vào CSDL.</span>
          </Link>
          <Link className="flex flex-col gap-2 rounded border border-neutral-700 p-4 hover:border-cyan-500" href="/admin/jobs">
            <span className="font-medium text-cyan-400">Tiến trình nền (Jobs)</span>
            <span className="text-xs text-neutral-400">Kiểm tra trạng thái (Đang xử lý, Lỗi, Thành công) của các tác vụ mất nhiều thời gian như đồng bộ dữ liệu, phân tích AI.</span>
          </Link>
          <Link className="flex flex-col gap-2 rounded border border-neutral-700 p-4 hover:border-cyan-500" href="/admin/audit">
            <span className="font-medium text-cyan-400">Nhật ký (Audit logs)</span>
            <span className="text-xs text-neutral-400">Xem lại lịch sử thay đổi trên hệ thống: ai đã thực hiện thao tác gì, vào lúc nào, tác động đến dữ liệu nào.</span>
          </Link>
        </div>
      </section>
    </main>
  );
}

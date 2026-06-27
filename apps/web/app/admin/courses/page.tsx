"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { useAdminGuard } from "@/lib/admin-auth";
import { apiJson } from "@/lib/api";

type Course = {
  id: number;
  code: string | null;
  name: string;
  credits: number | null;
  kind: string;
  difficulty: string | null;
  is_active: boolean;
};
type CourseList = { items: Course[] };

type CoursePrerequisiteItem = {
  prerequisite_id: number;
  kind: "prerequisite" | "prior";
};

type CourseDetail = Course & {
  prerequisites: CoursePrerequisiteItem[];
};

const COURSE_KIND_MAP: Record<string, string> = {
  general: "Môn Đại cương",
  foundation: "Môn cơ sở ngành",
  major: "Môn chuyên ngành",
  other: "Môn khác",
  elective: "Môn tự chọn",
  thesis_internship: "Đồ án, thực tập",
  // Fallbacks for older data
  core: "Môn bắt buộc (Cũ)",
  thesis: "Khóa luận (Cũ)",
  internship: "Thực tập (Cũ)",
};

const COURSE_DIFFICULTY_MAP: Record<string, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

export default function AdminCoursesPage() {
  const { me, loading } = useAdminGuard();
  const [items, setItems] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [prereqs, setPrereqs] = useState<CoursePrerequisiteItem[]>([]);

  const editData = editingId ? items.find((i) => i.id === editingId) : null;

  async function refresh() {
    setError(null);
    const r = await apiJson<CourseList>("/api/v1/admin/courses?limit=200");
    if (r.ok && r.data) {
      setItems(r.data.items);
    } else {
      setError(r.error || "Không thể tải danh sách môn học");
    }
  }

  useEffect(() => {
    if (me) void refresh();
  }, [me]);

  useEffect(() => {
    if (!editingId) {
      setPrereqs([]);
      return;
    }
    apiJson<CourseDetail>(`/api/v1/admin/courses/${editingId}`).then((r) => {
      if (r.ok && r.data) {
        setPrereqs(r.data.prerequisites);
      } else {
        setPrereqs([]);
      }
    });
  }, [editingId]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!me) return;
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const rawCode = String(fd.get("code") || "").trim();
    const payload = {
      code: rawCode ? rawCode : null,
      name: String(fd.get("name") || "").trim(),
      credits: fd.get("credits") ? Number(fd.get("credits")) : null,
      kind: String(fd.get("kind") || ""),
      difficulty: String(fd.get("difficulty") || ""),
    };

    if (editingId) {
      const r = await apiJson<Course>(`/api/v1/admin/courses/${editingId}`, {
        method: "PATCH",
        headers: { "X-CSRF-Token": me.csrf_token },
        body: JSON.stringify(payload),
      });
      if (!r.ok || !r.data) {
        setError(r.error || "Không thể cập nhật môn học");
        return;
      }

      if (prereqs !== null) {
        await apiJson(`/api/v1/admin/courses/${editingId}/prerequisites`, {
          method: "PUT",
          headers: { "X-CSRF-Token": me.csrf_token },
          body: JSON.stringify({ prerequisites: prereqs }),
        });
      }

      setItems((prev) => prev.map((c) => (c.id === editingId ? r.data! : c)));
      setEditingId(null);
      setPrereqs([]);
    } else {
      const r = await apiJson<Course>("/api/v1/admin/courses", {
        method: "POST",
        headers: { "X-CSRF-Token": me.csrf_token },
        body: JSON.stringify(payload),
      });
      if (!r.ok || !r.data) {
        setError(r.error || "create_failed");
        return;
      }
      const newCourse = r.data;
      if (prereqs.length > 0) {
        await apiJson(`/api/v1/admin/courses/${newCourse.id}/prerequisites`, {
          method: "PUT",
          headers: { "X-CSRF-Token": me.csrf_token },
          body: JSON.stringify({ prerequisites: prereqs }),
        });
      }
      setItems((prev) => [...prev, newCourse]);
      setPrereqs([]);
    }
    form.reset();
  }

  async function toggleActive(courseId: number, currentActive: boolean) {
    if (!me) return;
    setError(null);
    const r = await apiJson<Course>(`/api/v1/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "X-CSRF-Token": me.csrf_token },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    if (r.ok && r.data) {
      setItems((prev) => prev.map((c) => (c.id === courseId ? r.data! : c)));
    } else {
      setError(r.error || "Không thể thay đổi trạng thái kích hoạt");
    }
  }

  async function hardDelete(courseId: number, name: string) {
    if (!me) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xoá môn học "${name}" không?\nHành động này không thể hoàn tác!`,
      )
    ) {
      return;
    }
    setError(null);
    const r = await apiJson<void>(`/api/v1/admin/courses/${courseId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (r.ok) {
      setItems((prev) => prev.filter((c) => c.id !== courseId));
    } else {
      setError(r.error || "Không thể xoá môn học");
    }
  }

  if (loading)
    return (
      <div className="text-sm font-medium admin-fade-in animate-pulse" style={{ color: "var(--admin-text-muted)" }}>
        Đang tải...
      </div>
    );

  return (
    <main className="space-y-8 admin-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--admin-text)" }}>
            Quản lý Môn học
          </h1>
          <p className="text-xs" style={{ color: "var(--admin-text-muted)" }}>
            Quản lý danh sách các môn học của UIT
          </p>
        </div>
        <Link
          href="/admin"
          className="admin-btn admin-btn-secondary px-4 py-2 text-sm"
        >
          Quay lại dashboard
        </Link>
      </div>

      <form
        key={editingId || "new"}
        className="admin-panel space-y-6 p-6"
        onSubmit={onSubmit}
      >
        <h2 className="text-base font-semibold" style={{ color: "var(--admin-text)" }}>
          {editingId ? `Cập nhật môn học: ${editData?.name || ""}` : "Thêm môn học mới"}
        </h2>
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-5" style={{ borderColor: "var(--admin-border)" }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-text-secondary)" }}>Mã môn</label>
            <input name="code" defaultValue={editData?.code || ""} placeholder="VD: CS101" className="admin-input px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-text-secondary)" }}>Tên môn</label>
            <input name="name" required defaultValue={editData?.name || ""} placeholder="VD: Nhập môn lập trình" className="admin-input px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-text-secondary)" }}>Tín chỉ</label>
            <input name="credits" type="number" min={1} defaultValue={editData?.credits || ""} placeholder="VD: 3" className="admin-input px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-text-secondary)" }}>Loại</label>
            <select
              name="kind"
              required
              defaultValue={editData?.kind || ""}
              className="admin-select px-3 py-2 text-sm cursor-pointer"
            >
              <option value="general">Môn Đại cương</option>
              <option value="foundation">Môn cơ sở ngành</option>
              <option value="major">Môn chuyên ngành</option>
              <option value="other">Môn khác</option>
              <option value="elective">Môn tự chọn</option>
              <option value="thesis_internship">Đồ án, thực tập</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-text-secondary)" }}>
              Độ khó
            </label>
            <select
              name="difficulty"
              defaultValue={editData?.difficulty || ""}
              className="admin-select px-3 py-2 text-sm cursor-pointer"
            >
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3" style={{ borderColor: "var(--admin-border)" }}>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--admin-text-secondary)" }}>Môn tiên quyết / Môn học trước</label>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--admin-text-muted)" }}>
              * <strong>Môn tiên quyết:</strong> Môn học bắt buộc học sinh phải HỌC và ĐẠT (điểm &ge; 5) trước khi đăng ký môn hiện tại.<br />
              * <strong>Môn học trước:</strong> Môn học bắt buộc học sinh phải HỌC trước khi đăng ký môn hiện tại (chấp nhận điểm chưa đạt).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {prereqs.map((p) => {
              const pCourse = items.find((i) => i.id === p.prerequisite_id);
              return (
                <span
                  key={p.prerequisite_id}
                  className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
                  style={{
                    backgroundColor: p.kind === "prerequisite" ? "var(--admin-danger-soft)" : "var(--admin-accent-soft)",
                    borderColor: p.kind === "prerequisite" ? "rgba(220, 38, 38, 0.2)" : "var(--admin-border)",
                    color: p.kind === "prerequisite" ? "var(--admin-danger)" : "var(--admin-accent-text)",
                  }}
                >
                  <span className="font-bold uppercase text-[9px] tracking-wider opacity-80 mr-1">
                    {p.kind === "prerequisite" ? "Tiên quyết" : "Học trước"}
                  </span>
                  {pCourse ? `${pCourse.code || "[Không mã]"} - ${pCourse.name}` : `ID: ${p.prerequisite_id}`}
                  <button
                    type="button"
                    className="hover:opacity-70 ml-1 cursor-pointer"
                    onClick={() => {
                      setPrereqs((prev) => (prev ? prev.filter((item) => item.prerequisite_id !== p.prerequisite_id) : []));
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
            {prereqs.length === 0 && (
              <span className="text-xs italic py-1" style={{ color: "var(--admin-text-muted)" }}>Chưa có môn tiên quyết/học trước nào được gán</span>
            )}
          </div>
          <div className="flex gap-2 w-full md:max-w-2xl">
            <select
              id="prereq-select"
              className="admin-select flex-1 px-3 py-2 text-sm truncate cursor-pointer"
            >
              <option value="">-- Chọn môn học --</option>
              {items
                .filter((i) => i.id !== editingId && !prereqs.some((p) => p.prerequisite_id === i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code || "[Không mã]"} - {i.name}
                  </option>
                ))}
            </select>
            <select
              id="prereq-kind"
              className="admin-select px-3 py-2 text-sm shrink-0 cursor-pointer"
            >
              <option value="prerequisite">Môn tiên quyết</option>
              <option value="prior">Môn học trước</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const sel = document.getElementById("prereq-select") as HTMLSelectElement;
                const kindSel = document.getElementById("prereq-kind") as HTMLSelectElement;
                if (sel && sel.value && kindSel && kindSel.value) {
                  setPrereqs((prev) => [
                    ...(prev || []),
                    { prerequisite_id: Number(sel.value), kind: kindSel.value as "prerequisite" | "prior" },
                  ]);
                  sel.value = "";
                }
              }}
              className="admin-btn admin-btn-secondary px-4 py-2 text-sm"
            >
              Thêm môn
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="admin-btn admin-btn-primary flex-1 py-2.5 text-sm">
            {editingId ? "Lưu thay đổi" : "Tạo môn học"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setPrereqs([]);
              }}
              className="admin-btn admin-btn-secondary px-6 text-sm"
            >
              Hủy
            </button>
          ) : prereqs.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setPrereqs([]);
              }}
              className="admin-btn admin-btn-secondary px-6 text-sm"
            >
              Đặt lại điều kiện
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <div
          className="rounded-lg border p-4 text-sm font-medium"
          style={{
            backgroundColor: "var(--admin-danger-soft)",
            borderColor: "rgba(220, 38, 38, 0.2)",
            color: "var(--admin-danger)",
          }}
        >
          Lỗi: {error}
        </div>
      ) : null}

      <section className="admin-panel space-y-4 p-6">
        <h2 className="text-xs uppercase tracking-wider font-bold mb-3 flex items-center justify-between" style={{ color: "var(--admin-text-secondary)" }}>
          <span>Danh sách môn học</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "var(--admin-surface-2)", color: "var(--admin-text-secondary)" }}>
            {items.length} môn
          </span>
        </h2>
        {items.length === 0 ? (
          <p className="text-sm py-6 text-center italic" style={{ color: "var(--admin-text-muted)" }}>
            Chưa có môn học nào được tạo.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((c) => (
            <div
              key={c.id}
              className="admin-card rounded-xl p-5 flex flex-col justify-between"
              style={{
                backgroundColor: "var(--admin-surface)",
                border: "1px solid var(--admin-border)",
                opacity: c.is_active ? 1 : 0.65,
              }}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="font-bold text-[14px]"
                    style={{
                      color: "var(--admin-text)",
                      textDecoration: c.is_active ? "none" : "line-through",
                    }}
                  >
                    {c.code || <span className="italic font-normal" style={{ color: "var(--admin-text-faint)" }}>[Không có mã]</span>} - {c.name}
                  </p>
                  {c.is_active ? (
                    <span
                      className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                      style={{
                        backgroundColor: "var(--admin-success-soft)",
                        color: "var(--admin-success)",
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--admin-success)" }} />
                      Hoạt động
                    </span>
                  ) : (
                    <span
                      className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                      style={{
                        backgroundColor: "var(--admin-surface-2)",
                        color: "var(--admin-text-muted)",
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--admin-text-muted)" }} />
                      Đã ẩn
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--admin-text-secondary)" }}>
                  Tín chỉ:{" "}
                  <span className="font-semibold" style={{ color: "var(--admin-accent-text)" }}>{c.credits ?? "Tính riêng"}</span>{" "}
                  • Loại:{" "}
                  <span className="font-semibold" style={{ color: "var(--admin-text)" }}>
                    {COURSE_KIND_MAP[c.kind] || c.kind}
                  </span>{" "}
                  • Độ khó:{" "}
                  <span className="font-semibold" style={{ color: "var(--admin-text)" }}>
                    {c.difficulty
                      ? COURSE_DIFFICULTY_MAP[c.difficulty] || c.difficulty
                      : "-"}
                  </span>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t flex gap-2" style={{ borderColor: "var(--admin-border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(c.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="admin-btn admin-btn-secondary px-3 py-1.5 text-xs font-semibold"
                  title="Chỉnh sửa thông tin môn học"
                >
                  Chỉnh sửa
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(c.id, c.is_active)}
                  className={`admin-btn px-3 py-1.5 text-xs font-semibold ${
                    c.is_active
                      ? "admin-btn-secondary"
                      : "admin-btn-primary"
                  }`}
                  style={c.is_active ? { color: "var(--admin-warning)" } : undefined}
                  title={
                    c.is_active ? "Vô hiệu hóa môn học" : "Kích hoạt môn học"
                  }
                >
                  {c.is_active ? "Vô hiệu hoá" : "Kích hoạt"}
                </button>

                <button
                  type="button"
                  onClick={() => hardDelete(c.id, c.name)}
                  className="admin-btn admin-btn-danger px-3 py-1.5 text-xs font-semibold"
                  title="Xoá môn học"
                >
                  Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}


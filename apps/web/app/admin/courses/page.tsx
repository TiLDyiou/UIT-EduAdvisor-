"use client";

import { FormEvent, useEffect, useState } from "react";

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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!me) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      code: fd.get("code") ? String(fd.get("code")) : null,
      name: String(fd.get("name") || ""),
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
      setItems((prev) => prev.map((c) => (c.id === editingId ? r.data! : c)));
      setEditingId(null);
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
      setItems((prev) => [...prev, r.data!]);
    }
    e.currentTarget.reset();
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
      <main className="mx-auto max-w-5xl px-6 py-10 text-neutral-400">
        Đang tải...
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Quản lý Môn học
          </h1>
          <p className="text-xs text-neutral-400">
            Quản lý danh sách các môn học của UIT
          </p>
        </div>
        <a
          href="/admin"
          className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-cyan-400 hover:bg-neutral-800 transition-colors"
        >
          Quay lại dashboard
        </a>
      </div>

      <form
        key={editingId || "new"}
        className="space-y-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl"
        onSubmit={onSubmit}
      >
        <h2 className="text-base font-semibold text-neutral-200">
          {editingId ? `Cập nhật môn học: ${editData?.name || ""}` : "Thêm môn học mới"}
        </h2>
        <div className="grid gap-3 border-t border-neutral-900 pt-4 sm:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-neutral-400 font-medium">Mã môn</label>
            <input name="code" defaultValue={editData?.code || ""} placeholder="VD: CS101 (để trống nếu không có)" className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-neutral-400 font-medium">Tên môn</label>
            <input name="name" required defaultValue={editData?.name || ""} placeholder="VD: Nhập môn lập trình" className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-neutral-400 font-medium">Tín chỉ</label>
            <input name="credits" type="number" min={1} defaultValue={editData?.credits || ""} placeholder="VD: 3 (để trống nếu tính riêng)" className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-neutral-400 font-medium">Loại</label>
            <select
              name="kind"
              required
              defaultValue={editData?.kind || ""}
              className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
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
            <label className="text-xs text-neutral-400 font-medium">
              Độ khó
            </label>
            <select
              name="difficulty"
              defaultValue={editData?.difficulty || ""}
              className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
            >
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-cyan-600 py-2.5 font-semibold text-black hover:bg-cyan-500 hover:shadow-lg hover:shadow-cyan-600/20 active:scale-[0.98] transition-all">
            {editingId ? "Lưu thay đổi" : "Tạo môn học"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-4 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 transition-all font-medium"
            >
              Hủy
            </button>
          )}
        </div>
      </form>

      {error ? (
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
          Lỗi: {error}
        </div>
      ) : null}

      <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="text-sm uppercase tracking-wider font-semibold text-neutral-400 mb-3 flex items-center justify-between">
          <span>Danh sách môn học</span>
          <span className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 px-2.5 py-0.5 rounded-full font-normal">
            {items.length} môn
          </span>
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center">
            Chưa có môn học nào được tạo.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border p-4 transition-all flex flex-col justify-between ${
                c.is_active
                  ? "border-neutral-800 bg-neutral-900/10 hover:border-neutral-700"
                  : "border-neutral-900 bg-neutral-950/40 opacity-70 hover:border-neutral-800"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`font-semibold ${c.is_active ? "text-neutral-200" : "text-neutral-400 line-through"}`}
                  >
                    {c.code || <span className="italic font-normal text-neutral-500">[Không có mã]</span>} - {c.name}
                  </p>
                  {c.is_active ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Hoạt động
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-neutral-850 border border-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                      Đã ẩn
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Tín chỉ:{" "}
                  <span className="text-cyan-400 font-medium">{c.credits ?? "Tính riêng"}</span>{" "}
                  • Loại:{" "}
                  <span className="text-neutral-300 font-medium">
                    {COURSE_KIND_MAP[c.kind] || c.kind}
                  </span>{" "}
                  • Độ khó:{" "}
                  <span className="text-neutral-300 font-medium">
                    {c.difficulty
                      ? COURSE_DIFFICULTY_MAP[c.difficulty] || c.difficulty
                      : "-"}
                  </span>
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-neutral-900 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(c.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="rounded-lg py-1.5 px-2.5 text-xs font-medium border border-neutral-800 bg-neutral-900 text-cyan-400 hover:bg-neutral-800 hover:border-neutral-700 transition-all"
                  title="Chỉnh sửa thông tin môn học"
                >
                  Chỉnh sửa
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(c.id, c.is_active)}
                  className={`rounded-lg py-1.5 px-2.5 text-xs font-medium border transition-all ${
                    c.is_active
                      ? "bg-neutral-900 border-neutral-800 text-amber-500 hover:bg-amber-950/20 hover:border-amber-500/30"
                      : "bg-emerald-950/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-500/40"
                  }`}
                  title={
                    c.is_active ? "Vô hiệu hóa môn học" : "Kích hoạt môn học"
                  }
                >
                  {c.is_active ? "Vô hiệu hoá" : "Kích hoạt"}
                </button>

                <button
                  type="button"
                  onClick={() => hardDelete(c.id, c.name)}
                  className="rounded-lg py-1.5 px-2.5 text-xs font-medium border border-neutral-800 bg-neutral-950 text-rose-500 hover:bg-rose-950/30 hover:border-rose-500/40 hover:text-rose-400 transition-all"
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

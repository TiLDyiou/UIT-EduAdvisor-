"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { useAdminGuard } from "@/lib/admin-auth";
import { apiJson } from "@/lib/api";

type Curriculum = {
  id: number;
  major_id: number;
  name: string;
  effective_year: number;
  total_credits: number;
  is_active: boolean;
};
type CurriculumList = { items: Curriculum[] };

type Major = {
  id: number;
  code: string;
  name: string;
};
type MajorList = { items: Major[] };

type Course = {
  id: number;
  code: string;
  name: string;
  credits: number;
  kind: string;
  difficulty: string | null;
};

type TermCourse = {
  course_id: number;
  is_required: boolean;
};

type CurriculumTerm = {
  id?: number;
  term_number: number;
  courses: TermCourse[];
};

type ElectiveGroup = {
  id?: number;
  name: string;
  rule_type: "min_credits" | "min_courses";
  required_value: number;
  course_ids: number[];
};

type CurriculumDetail = {
  id: number;
  major_id: number;
  name: string;
  effective_year: number;
  total_credits: number;
  is_active: boolean;
  terms: CurriculumTerm[];
  elective_groups: ElectiveGroup[];
};

export default function AdminCurriculaPage() {
  const { me, loading } = useAdminGuard();
  const [items, setItems] = useState<Curriculum[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [selectedMajorId, setSelectedMajorId] = useState<string>("");
  const [isAddingNewMajor, setIsAddingNewMajor] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // States for Structure Editor
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDetail, setEditDetail] = useState<CurriculumDetail | null>(null);
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [structureSuccess, setStructureSuccess] = useState<string | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});

  const refresh = useCallback(async () => {
    setError(null);
    const [rc, rm] = await Promise.all([
      apiJson<CurriculumList>("/api/v1/admin/curricula?limit=100"),
      apiJson<MajorList>("/api/v1/admin/curricula/majors")
    ]);
    if (rc.ok && rc.data) {
      setItems(rc.data.items);
    } else if (!rc.ok) {
      setError(rc.error || "Không thể tải danh sách chương trình");
    }

    if (rm.ok && rm.data) {
      setMajors(rm.data.items);
      // Auto-select the first major if none is selected yet and items are available
      if (rm.data.items.length > 0 && !selectedMajorId) {
        setSelectedMajorId(String(rm.data.items[0].id));
      }
    } else if (!rm.ok) {
      setError(rm.error || "Không thể tải danh sách ngành");
    }
  }, [selectedMajorId]);

  useEffect(() => {
    if (me) void refresh();
  }, [me, refresh]);

  // Adjust selectedMajorId if list changes
  useEffect(() => {
    if (majors.length > 0 && !selectedMajorId) {
      setSelectedMajorId(String(majors[0].id));
    }
  }, [majors, selectedMajorId]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!me) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    
    const payload: {
      name: string;
      effective_year: number;
      total_credits: number;
      major_id?: number;
      major_code?: string;
      major_name?: string;
    } = {
      name: String(fd.get("name") || "").trim(),
      effective_year: Number(fd.get("effective_year") || 0),
      total_credits: Number(fd.get("total_credits") || 0),
    };

    if (!isAddingNewMajor) {
      if (!selectedMajorId) {
        setError("Vui lòng chọn một ngành học từ danh sách hoặc thêm ngành mới.");
        return;
      }
      payload.major_id = Number(selectedMajorId);
    } else {
      const majorCode = String(fd.get("major_code") || "").trim();
      const majorName = String(fd.get("major_name") || "").trim();
      if (!majorCode || !majorName) {
        setError("Vui lòng nhập đầy đủ Mã ngành và Tên ngành mới.");
        return;
      }
      payload.major_code = majorCode;
      payload.major_name = majorName;
    }

    const r = await apiJson<Curriculum>("/api/v1/admin/curricula", {
      method: "POST",
      headers: { "X-CSRF-Token": me.csrf_token },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      setError(r.error || "create_failed");
      return;
    }

    // Reset and reload
    setIsAddingNewMajor(false);
    e.currentTarget.reset();
    await refresh();
  }

  async function toggleActive(curriculumId: number, currentActive: boolean) {
    if (!me) return;
    setError(null);
    const r = await apiJson<CurriculumDetail>(`/api/v1/admin/curricula/${curriculumId}`, {
      method: "PATCH",
      headers: { "X-CSRF-Token": me.csrf_token },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    if (r.ok) {
      await refresh();
    } else {
      setError(r.error || "Không thể thay đổi trạng thái kích hoạt");
    }
  }

  async function hardDelete(curriculumId: number, name: string) {
    if (!me) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xoá cứng chương trình đào tạo "${name}" không?\nHành động này sẽ xoá toàn bộ cấu trúc học kỳ và các nhóm tự chọn liên quan và không thể hoàn tác!`)) {
      return;
    }
    setError(null);
    const r = await apiJson<void>(`/api/v1/admin/curricula/${curriculumId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (r.ok) {
      if (editingId === curriculumId) {
        setEditingId(null);
        setEditDetail(null);
      }
      await refresh();
    } else {
      setError(r.error || "Không thể xoá chương trình đào tạo");
    }
  }

  // --- Visual Structure Editor Actions ---

  const normalizeTerms = (terms: CurriculumTerm[]): CurriculumTerm[] => {
    const normalized = [...terms];
    for (let i = 1; i <= 8; i++) {
      if (!normalized.some(t => t.term_number === i)) {
        normalized.push({ term_number: i, courses: [] });
      }
    }
    return normalized.sort((a, b) => a.term_number - b.term_number);
  };

  const startEditing = async (id: number) => {
    setEditingId(id);
    setIsLoadingDetail(true);
    setStructureError(null);
    setStructureSuccess(null);
    
    // Smoothly scroll to the structure editor when it opens
    setTimeout(() => {
      document.getElementById("structure-editor")?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    // Fetch courses if not already loaded
    if (coursesList.length === 0) {
      const cr = await apiJson<{ items: Course[] }>("/api/v1/admin/courses?limit=500");
      if (cr.ok && cr.data) {
        setCoursesList(cr.data.items);
      }
    }

    const r = await apiJson<CurriculumDetail>(`/api/v1/admin/curricula/${id}`);
    setIsLoadingDetail(false);
    if (r.ok && r.data) {
      setEditDetail({
        ...r.data,
        terms: normalizeTerms(r.data.terms)
      });
    } else {
      setStructureError(r.error || "Không thể tải chi tiết chương trình");
    }
  };

  const addCourseToTerm = (termNum: number, courseId: number, isRequired: boolean) => {
    if (!editDetail) return;
    
    // Check if course already exists in the curriculum to prevent duplicate assignments
    const alreadyExists = editDetail.terms.some(t => t.courses.some(c => c.course_id === courseId));
    if (alreadyExists) {
      setStructureError("Môn học này đã được gán vào chương trình đào tạo rồi.");
      return;
    }

    const updatedTerms = editDetail.terms.map(t => {
      if (t.term_number === termNum) {
        return {
          ...t,
          courses: [...t.courses, { course_id: courseId, is_required: isRequired }]
        };
      }
      return t;
    });

    setEditDetail({
      ...editDetail,
      terms: updatedTerms
    });
    setStructureError(null);
  };

  const removeCourseFromTerm = (termNum: number, courseId: number) => {
    if (!editDetail) return;
    const updatedTerms = editDetail.terms.map(t => {
      if (t.term_number === termNum) {
        return {
          ...t,
          courses: t.courses.filter(c => c.course_id !== courseId)
        };
      }
      return t;
    });

    // Automatically remove this course from any elective groups as well to maintain DB consistency
    const updatedGroups = editDetail.elective_groups.map(g => ({
      ...g,
      course_ids: g.course_ids.filter(id => id !== courseId)
    }));

    setEditDetail({
      ...editDetail,
      terms: updatedTerms,
      elective_groups: updatedGroups
    });
    setStructureError(null);
  };

  const toggleCourseRequired = (termNum: number, courseId: number) => {
    if (!editDetail) return;
    const updatedTerms = editDetail.terms.map(t => {
      if (t.term_number === termNum) {
        return {
          ...t,
          courses: t.courses.map(c => {
            if (c.course_id === courseId) {
              return { ...c, is_required: !c.is_required };
            }
            return c;
          })
         };
       }
       return t;
    });
     
    // If a course becomes compulsory (is_required = true), remove it from any elective groups
    const wasRequired = editDetail.terms
      .find(t => t.term_number === termNum)
      ?.courses.find(c => c.course_id === courseId)
      ?.is_required;
     
    let updatedGroups = editDetail.elective_groups;
    if (!wasRequired) {
      updatedGroups = editDetail.elective_groups.map(g => ({
        ...g,
        course_ids: g.course_ids.filter(id => id !== courseId)
      }));
    }

    setEditDetail({
      ...editDetail,
      terms: updatedTerms,
      elective_groups: updatedGroups
    });
    setStructureError(null);
  };

  const addElectiveGroup = (name: string, ruleType: "min_credits" | "min_courses", requiredValue: number) => {
    if (!editDetail) return;
    const newGroup: ElectiveGroup = {
      name: name.trim() || "Nhóm tự chọn mới",
      rule_type: ruleType,
      required_value: requiredValue,
      course_ids: []
    };
    setEditDetail({
      ...editDetail,
      elective_groups: [...editDetail.elective_groups, newGroup]
    });
    setStructureError(null);
  };

  const removeElectiveGroup = (index: number) => {
    if (!editDetail) return;
    setEditDetail({
      ...editDetail,
      elective_groups: editDetail.elective_groups.filter((_, i) => i !== index)
    });
    setStructureError(null);
  };

  const toggleCourseInElectiveGroup = (groupIndex: number, courseId: number) => {
    if (!editDetail) return;
    const updatedGroups = editDetail.elective_groups.map((g, idx) => {
      if (idx === groupIndex) {
        const exists = g.course_ids.includes(courseId);
        return {
          ...g,
          course_ids: exists 
            ? g.course_ids.filter(id => id !== courseId)
            : [...g.course_ids, courseId]
        };
      }
      return g;
    });
    setEditDetail({
      ...editDetail,
      elective_groups: updatedGroups
    });
    setStructureError(null);
  };

  const saveStructure = async () => {
    if (!editDetail || !me) return;
    setStructureError(null);
    setStructureSuccess(null);

    // Prepare structure payload
    const payload = {
      terms: editDetail.terms
        .filter(t => t.courses.length > 0)
        .map(t => ({
          term_number: t.term_number,
          courses: t.courses.map(c => ({
            course_id: c.course_id,
            is_required: c.is_required
          }))
        })),
      elective_groups: editDetail.elective_groups.map(g => ({
        name: g.name,
        rule_type: g.rule_type,
        required_value: g.required_value,
        course_ids: g.course_ids
      }))
    };

    const r = await apiJson<CurriculumDetail>(`/api/v1/admin/curricula/${editDetail.id}/structure`, {
      method: "PUT",
      headers: { "X-CSRF-Token": me.csrf_token },
      body: JSON.stringify(payload),
    });

    if (r.ok && r.data) {
      setStructureSuccess("Lưu cấu trúc chương trình đào tạo thành công!");
      await refresh();
      setEditDetail({
        ...r.data,
        terms: normalizeTerms(r.data.terms)
      });
    } else {
      setStructureError(r.error || "Không thể lưu cấu trúc. Vui lòng kiểm tra lại ràng buộc.");
    }
  };

  if (loading) return <main className="mx-auto max-w-5xl px-6 py-10 text-neutral-400">Đang tải...</main>;
  
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Chương trình đào tạo
          </h1>
          <p className="text-xs text-neutral-400">Quản lý các chương trình đào tạo và khung kiến thức của UIT</p>
        </div>
        <a href="/admin" className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-cyan-400 hover:bg-neutral-800 transition-colors">
          Quay lại dashboard
        </a>
      </div>
      
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-300 backdrop-blur-md">
        <p className="font-semibold text-cyan-400 mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Hướng dẫn sử dụng:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
          <li>Chức năng này cho phép quản lý danh sách các <strong>Khung chương trình đào tạo</strong> của trường.</li>
          <li>Bạn có thể chọn <strong>Tên ngành</strong> từ trình đơn thả xuống. Hệ thống sẽ tự động điền <strong>Mã ngành</strong> (VD: 7480202).</li>
          <li>Nếu không tìm thấy tên ngành cần tìm, hãy nhấn <strong>+ Thêm ngành mới</strong> để khai báo ngành học mới.</li>
          <li>Sau khi tạo chương trình đào tạo, nhấn nút <strong>Cấu trúc chương trình</strong> ở mỗi thẻ để tiến hành gán môn học vào từng học kỳ và tạo các nhóm tự chọn chuyên ngành.</li>
        </ul>
      </div>

      <form className="space-y-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl" onSubmit={onCreate}>
        <h2 className="text-base font-semibold text-neutral-200">Tạo chương trình đào tạo mới</h2>
        
        {/* Dynamic Fields based on mode */}
        <div className="grid gap-6 md:grid-cols-2 border-t border-neutral-900 pt-4">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Thông tin Ngành</h3>
            
            {!isAddingNewMajor ? (
              <div className="space-y-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400 font-medium">Tên ngành</label>
                  <select
                    value={selectedMajorId}
                    onChange={(e) => setSelectedMajorId(e.target.value)}
                    className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors cursor-pointer w-full"
                  >
                    {majors.length === 0 ? (
                      <option value="">-- Chưa có ngành nào trong DB --</option>
                    ) : (
                      majors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs text-neutral-400 font-medium">Mã ngành (tự động điền)</label>
                    <input
                      type="text"
                      readOnly
                      value={majors.find((m) => String(m.id) === selectedMajorId)?.code || ""}
                      placeholder="Chọn ngành ở trên..."
                      className="rounded-lg bg-neutral-900/50 border border-neutral-800/80 px-3 py-2 text-sm text-neutral-300 font-mono focus:outline-none cursor-default"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewMajor(true)}
                    className="rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 text-xs py-2.5 font-medium text-cyan-400 transition-colors h-[38px] flex items-center justify-center"
                  >
                    + Thêm ngành mới
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Đang thêm ngành mới</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewMajor(false)}
                    className="text-xs text-neutral-400 hover:text-cyan-400 transition-colors"
                  >
                    ← Chọn từ danh sách ngành
                  </button>
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-neutral-400 font-medium">Mã ngành mới</label>
                    <input
                      name="major_code"
                      required
                      placeholder="VD: 7480202"
                      className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-neutral-400 font-medium">Tên ngành mới</label>
                    <input
                      name="major_name"
                      required
                      placeholder="VD: Công nghệ Thông tin (Chất lượng cao)"
                      className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Thông tin Khung đào tạo</h3>
            <div className="grid gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-neutral-400 font-medium">Tên chương trình đào tạo</label>
                <input
                  name="name"
                  required
                  placeholder="VD: CTDT Kỹ thuật Phần mềm CLC 2023"
                  className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400 font-medium">Năm áp dụng</label>
                  <input
                    name="effective_year"
                    required
                    type="number"
                    placeholder="VD: 2023"
                    className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-400 font-medium">Tổng tín chỉ</label>
                  <input
                    name="total_credits"
                    required
                    type="number"
                    placeholder="VD: 130"
                    className="rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button className="w-full rounded-lg bg-cyan-600 py-2.5 font-semibold text-black hover:bg-cyan-500 hover:shadow-lg hover:shadow-cyan-600/20 active:scale-[0.98] transition-all">
          Tạo mới Chương trình
        </button>
      </form>

      {error ? (
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
          Lỗi: {error}
        </div>
      ) : null}

      {/* Visually stunning Curriculum Structure Editor panel */}
      {editingId && (
        <section id="structure-editor" className="space-y-6 rounded-xl border border-cyan-900/50 bg-neutral-950 p-6 shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-200 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                Cấu hình môn học cho: <span className="text-cyan-400">{editDetail?.name || "..."}</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Thiết lập môn học bắt buộc/tự chọn cho từng học kỳ và tạo nhóm môn tự chọn ràng buộc.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setEditDetail(null);
              }}
              className="text-xs rounded-lg border border-neutral-850 bg-neutral-900 px-3 py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
            >
              Đóng trình biên tập
            </button>
          </div>

          {structureError ? (
            <div className="rounded-lg border border-red-900 bg-red-950/20 p-3 text-xs text-red-400">
              Lỗi: {structureError}
            </div>
          ) : null}
          {structureSuccess ? (
            <div className="rounded-lg border border-emerald-950 bg-emerald-950/20 p-3 text-xs text-emerald-400 border-emerald-900/55">
              {structureSuccess}
            </div>
          ) : null}

          {isLoadingDetail ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 space-y-3">
              <span className="h-6 w-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></span>
              <p className="text-xs">Đang tải cấu trúc chương trình đào tạo...</p>
            </div>
          ) : editDetail ? (
            <div className="space-y-6">
              {/* Academic Years Semesters Grids */}
              <div className="grid gap-6">
                {[
                  { year: 1, label: "Năm học 1 (Học kỳ 1 & 2)", terms: [1, 2] },
                  { year: 2, label: "Năm học 2 (Học kỳ 3 & 4)", terms: [3, 4] },
                  { year: 3, label: "Năm học 3 (Học kỳ 5 & 6)", terms: [5, 6] },
                  { year: 4, label: "Năm học 4 (Học kỳ 7 & 8)", terms: [7, 8] }
                ].map(yr => (
                  <div key={yr.year} className="space-y-3 rounded-lg border border-neutral-900 bg-neutral-900/10 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-500/80 border-b border-neutral-900 pb-2">
                      {yr.label}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {yr.terms.map(tNum => {
                        const termData = editDetail.terms.find(t => t.term_number === tNum) || { term_number: tNum, courses: [] };
                        const tSearch = searchTerms[tNum] || "";
                        
                        // Filter courses that are not already assigned to ANY term in the curriculum
                        const addedCourseIds = new Set(editDetail.terms.flatMap(t => t.courses.map(c => c.course_id)));
                        const filteredCourses = coursesList.filter(c => {
                          if (addedCourseIds.has(c.id)) return false;
                          if (!tSearch) return true;
                          return (c.name?.toLowerCase() || "").includes(tSearch.toLowerCase()) || 
                                 (c.code?.toLowerCase() || "").includes(tSearch.toLowerCase());
                        });

                        return (
                          <div key={tNum} className="flex flex-col justify-between rounded-lg border border-neutral-900 bg-neutral-950 p-4">
                            <div>
                              <h4 className="text-xs font-bold text-neutral-300 mb-2.5 flex items-center justify-between">
                                <span>Học kỳ {tNum}</span>
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  ({termData.courses.length} môn)
                                </span>
                              </h4>

                              {/* Term Course List */}
                              <div className="space-y-1.5 mb-4 max-h-[220px] overflow-y-auto pr-1">
                                {termData.courses.length === 0 ? (
                                  <p className="text-[11px] text-neutral-600 italic py-3 text-center">Chưa có môn học nào ở học kỳ này.</p>
                                ) : (
                                  termData.courses.map(tc => {
                                    const courseObj = coursesList.find(c => c.id === tc.course_id);
                                    if (!courseObj) return null;
                                    return (
                                      <div key={tc.course_id} className="flex items-center justify-between gap-2 rounded bg-neutral-900/40 border border-neutral-900 p-2 text-xs">
                                        <div className="min-w-0 flex-1">
                                          <p className="font-medium text-neutral-200 truncate">{courseObj.name}</p>
                                          <p className="text-[10px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                                            <span className="font-mono">{courseObj.code}</span>
                                            <span>•</span>
                                            <span>{courseObj.credits} tín chỉ</span>
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => toggleCourseRequired(tNum, tc.course_id)}
                                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase transition-all ${
                                              tc.is_required
                                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20"
                                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                            }`}
                                            title="Nhấn để đổi trạng thái"
                                          >
                                            {tc.is_required ? "Bắt buộc" : "Tự chọn"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => removeCourseFromTerm(tNum, tc.course_id)}
                                            className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                                            title="Xoá khỏi học kỳ"
                                          >
                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            {/* Add course controls */}
                            <div className="border-t border-neutral-900 pt-3 space-y-2">
                              <div className="relative flex gap-2 w-full">
                                <input
                                  type="text"
                                  placeholder="Tìm nhanh môn học..."
                                  value={tSearch}
                                  onChange={(e) => setSearchTerms({ ...searchTerms, [tNum]: e.target.value })}
                                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-[11px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                                {tSearch ? (
                                  <button
                                    type="button"
                                    onClick={() => setSearchTerms({ ...searchTerms, [tNum]: "" })}
                                    className="text-[10px] text-neutral-500 hover:text-neutral-300 px-1 shrink-0"
                                  >
                                    Xoá
                                  </button>
                                ) : null}

                                {tSearch && (
                                  <ul className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-800 border border-neutral-700 rounded-lg shadow-2xl z-50 py-1">
                                    {filteredCourses.length === 0 ? (
                                      <li className="px-3 py-2 text-[11px] text-neutral-400 italic">
                                        Không tìm thấy môn học phù hợp
                                      </li>
                                    ) : (
                                      filteredCourses.map(c => (
                                        <li
                                          key={c.id}
                                          className="px-3 py-2 text-[11px] text-neutral-200 hover:bg-cyan-600 hover:text-black cursor-pointer truncate transition-colors flex items-center gap-2"
                                          onClick={() => {
                                            const cSelect = document.getElementById(`course-select-${tNum}`) as HTMLSelectElement | null;
                                            if (cSelect) {
                                              cSelect.value = String(c.id);
                                            }
                                            setSearchTerms({ ...searchTerms, [tNum]: "" });
                                          }}
                                        >
                                          <span className="font-mono text-cyan-400 font-semibold">{c.code}</span>
                                          <span>{c.name} ({c.credits} TC)</span>
                                        </li>
                                      ))
                                    )}
                                  </ul>
                                )}
                              </div>
                              
                              <div className="flex gap-2 w-full">
                                <select
                                  id={`course-select-${tNum}`}
                                  className="flex-1 min-w-0 rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-[11px] focus:outline-none focus:border-cyan-500 cursor-pointer text-neutral-300 truncate"
                                >
                                  {filteredCourses.length === 0 ? (
                                    <option value="">-- Không có môn khả dụng --</option>
                                  ) : (
                                    <>
                                      <option value="">-- Chọn môn học ({filteredCourses.length}) --</option>
                                      {filteredCourses.map(c => (
                                        <option key={c.id} value={c.id}>
                                          {c.code} - {c.name} ({c.credits} TC)
                                        </option>
                                      ))}
                                    </>
                                  )}
                                </select>
                                
                                <select
                                  id={`req-select-${tNum}`}
                                  className="shrink-0 rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-[11px] text-neutral-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                                >
                                  <option value="true">Bắt buộc</option>
                                  <option value="false">Tự chọn</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const cSelect = document.getElementById(`course-select-${tNum}`) as HTMLSelectElement | null;
                                    const rSelect = document.getElementById(`req-select-${tNum}`) as HTMLSelectElement | null;
                                    if (!cSelect || !rSelect || !cSelect.value) return;
                                    
                                    addCourseToTerm(
                                      tNum,
                                      Number(cSelect.value),
                                      rSelect.value === "true"
                                    );
                                    cSelect.value = "";
                                  }}
                                  className="shrink-0 rounded bg-cyan-600 px-3 py-1 text-[11px] font-bold text-black hover:bg-cyan-500 transition-colors whitespace-nowrap"
                                >
                                  Thêm
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Elective Groups Section */}
              <div className="rounded-lg border border-neutral-900 bg-neutral-900/10 p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-500 border-b border-neutral-900 pb-2">
                  Quản lý Nhóm môn Tự chọn (Elective Groups)
                </h3>
                
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Create Elective Group Form */}
                  <div className="md:col-span-1 rounded-lg border border-neutral-800 bg-neutral-950 p-4 space-y-3.5 h-fit">
                    <h4 className="text-xs font-semibold text-neutral-300">Tạo nhóm tự chọn mới</h4>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-neutral-400">Tên nhóm</label>
                      <input
                        id="new-group-name"
                        placeholder="VD: Tự chọn chuyên ngành KTPM"
                        className="rounded bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] text-neutral-400">Loại luật</label>
                        <select
                          id="new-group-rule"
                          className="rounded bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="min_credits">Tối thiểu tín chỉ</option>
                          <option value="min_courses">Tối thiểu số môn</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] text-neutral-400">Yêu cầu tối thiểu</label>
                        <input
                          id="new-group-value"
                          type="number"
                          defaultValue="3"
                          className="rounded bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nInput = document.getElementById("new-group-name") as HTMLInputElement | null;
                        const rSelect = document.getElementById("new-group-rule") as HTMLSelectElement | null;
                        const vInput = document.getElementById("new-group-value") as HTMLInputElement | null;
                        if (!nInput || !rSelect || !vInput || !nInput.value) return;

                        addElectiveGroup(
                          nInput.value,
                          rSelect.value as "min_credits" | "min_courses",
                          Number(vInput.value)
                        );
                        
                        nInput.value = "";
                      }}
                      className="w-full rounded bg-cyan-600 py-1.5 text-xs font-semibold text-black hover:bg-cyan-500 transition-colors"
                    >
                      Tạo nhóm
                    </button>
                  </div>

                  {/* Elective Groups List */}
                  <div className="md:col-span-2 space-y-4">
                    {editDetail.elective_groups.length === 0 ? (
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-center text-xs text-neutral-500 italic">
                        Chưa cấu hình nhóm tự chọn nào. Hãy tạo một nhóm mới ở biểu mẫu bên cạnh!
                      </div>
                    ) : (
                      editDetail.elective_groups.map((group, gIdx) => {
                        const termCourses = editDetail.terms.flatMap(t => t.courses);
                        // Eligible courses are those that exist in semesters AND are elective (not compulsory)
                        const eligibleCourses = termCourses
                          .map(tc => coursesList.find(c => c.id === tc.course_id))
                          .filter((c): c is Course => c !== undefined && !termCourses.find(tc => tc.course_id === c.id)?.is_required);

                        return (
                          <div key={gIdx} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                              <div>
                                <h4 className="text-xs font-bold text-neutral-200">{group.name}</h4>
                                <p className="text-[10px] text-neutral-500 mt-0.5">
                                  Luật: <span className="text-cyan-400 font-medium">
                                    {group.rule_type === "min_credits" ? `Tối thiểu ${group.required_value} tín chỉ` : `Tối thiểu ${group.required_value} môn`}
                                  </span>
                                  {" "}• Đã chọn: <span className="font-mono text-neutral-300">{group.course_ids.length} môn</span>
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeElectiveGroup(gIdx)}
                                className="text-[10px] text-red-400 hover:text-red-300 hover:underline transition-colors"
                              >
                                Xoá nhóm
                              </button>
                            </div>

                            {eligibleCourses.length === 0 ? (
                              <p className="text-[10px] text-neutral-600 italic py-1">
                                Không có môn tự chọn nào trong học kỳ hiện tại để chọn vào nhóm này. Hãy thêm môn tự chọn vào học kỳ trước!
                              </p>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2 max-h-[140px] overflow-y-auto pr-1">
                                {eligibleCourses.map(c => {
                                  const isChecked = group.course_ids.includes(c.id);
                                  return (
                                    <label
                                      key={c.id}
                                      className={`flex items-center gap-2 rounded border p-2 cursor-pointer transition-colors text-[11px] ${
                                        isChecked
                                          ? "bg-cyan-500/5 border-cyan-500/25 text-neutral-200"
                                          : "bg-neutral-900/40 border-neutral-900 text-neutral-450 hover:bg-neutral-900 text-neutral-400"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleCourseInElectiveGroup(gIdx, c.id)}
                                        className="accent-cyan-500 cursor-pointer h-3.5 w-3.5 rounded bg-neutral-900 border-neutral-800 text-cyan-500 focus:ring-0"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{c.name}</p>
                                        <p className="text-[9px] text-neutral-500 font-mono mt-0.5">{c.code} ({c.credits} TC)</p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-neutral-900 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditDetail(null);
                  }}
                  className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-5 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
                >
                  Hủy thay đổi
                </button>
                <button
                  type="button"
                  onClick={saveStructure}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2 text-sm font-semibold text-black hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] transition-all hover:shadow-lg hover:shadow-cyan-500/20"
                >
                  Lưu cấu trúc Chương trình
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 text-center py-6">Không tìm thấy thông tin cấu trúc.</p>
          )}
        </section>
      )}

      {/* Existing Curricula Listing Section */}
      <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="text-sm uppercase tracking-wider font-semibold text-neutral-400 mb-3 flex items-center justify-between">
          <span>Danh sách hiện có</span>
          <span className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 px-2.5 py-0.5 rounded-full font-normal">
            {items.length} khung
          </span>
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center">Chưa có chương trình đào tạo nào được tạo.</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((x) => (
            <div
              key={x.id}
              className={`rounded-lg border p-4 transition-all flex flex-col justify-between ${
                x.is_active
                  ? "border-neutral-800 bg-neutral-900/10 hover:border-neutral-700"
                  : "border-neutral-900 bg-neutral-950/40 opacity-70 hover:border-neutral-800"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-semibold ${x.is_active ? "text-neutral-200" : "text-neutral-400 line-through"}`}>
                    {x.name}
                  </p>
                  {x.is_active ? (
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
                  Năm áp dụng: <span className="text-cyan-400 font-medium">{x.effective_year}</span>
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-900 mt-3 pt-3 text-xs text-neutral-400">
                <span>Mã ngành: <strong className="text-neutral-300 font-semibold">{majors.find((m) => m.id === x.major_id)?.code || x.major_id}</strong></span>
                <span>Tín chỉ: <strong className="text-neutral-300 font-semibold">{x.total_credits} TC</strong></span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-neutral-900 flex gap-2">
                <button
                  type="button"
                  onClick={() => startEditing(x.id)}
                  className={`flex-1 rounded-lg py-1.5 px-3 text-xs font-semibold transition-all ${
                    editingId === x.id 
                      ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" 
                      : "bg-neutral-900 border border-neutral-800 text-cyan-400 hover:bg-neutral-800 hover:text-cyan-300"
                  }`}
                >
                  {editingId === x.id ? "Đang cấu hình..." : "Cấu trúc"}
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleActive(x.id, x.is_active)}
                  className={`rounded-lg py-1.5 px-2.5 text-xs font-medium border transition-all ${
                    x.is_active
                      ? "bg-neutral-900 border-neutral-800 text-amber-500 hover:bg-amber-950/20 hover:border-amber-500/30"
                      : "bg-emerald-950/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-500/40"
                  }`}
                  title={x.is_active ? "Vô hiệu hóa chương trình" : "Kích hoạt chương trình"}
                >
                  {x.is_active ? "Vô hiệu hoá" : "Kích hoạt"}
                </button>

                <button
                  type="button"
                  onClick={() => hardDelete(x.id, x.name)}
                  className="rounded-lg py-1.5 px-2.5 text-xs font-medium border border-neutral-800 bg-neutral-950 text-rose-500 hover:bg-rose-950/30 hover:border-rose-500/40 hover:text-rose-400 transition-all"
                  title="Xoá cứng chương trình"
                >
                  Xoá cứng
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

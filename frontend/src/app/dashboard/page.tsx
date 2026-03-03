"use client";

/**
 * Dashboard Page — Hiển thị thông tin sinh viên và Roadmap.
 *
 * Đọc MSSV từ query params, fetch dữ liệu từ API,
 * và render RoadmapView.
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getStudent, getSubjects } from "@/lib/api";
import type { StudentResponse, SubjectResponse } from "@/lib/api";
import RoadmapView from "@/components/RoadmapView";
import { Loader2, GraduationCap, BookOpen, TrendingUp, AlertTriangle, Star, CheckCircle } from "lucide-react";

function DashboardContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Ưu tiên MSSV từ URL để chia sẻ được, nếu không có thì lấy user đang login
  const mssv = searchParams.get("mssv") || user?.mssv;

  const [student, setStudent] = useState<StudentResponse | null>(null);
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!mssv) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        const [studentData, subjectsData] = await Promise.all([
          getStudent(mssv!),
          getSubjects(),
        ]);
        setStudent(studentData);
        setSubjects(subjectsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [mssv]);

  // No MSSV — show prompt
  if (!mssv) {
    return (
      <main className="page-container">
        <div className="empty-state">
          <GraduationCap size={64} strokeWidth={1} />
          <h2>Chào bạn đến với UIT EduAdvisor!</h2>
          <p>Bạn chưa đăng nhập. Vui lòng <a href="/upload" className="link">upload bảng điểm</a> để đăng nhập & xem Roadmap.</p>
        </div>
      </main>
    );
  }

  // Loading
  if (loading) {
    return (
      <main className="page-container">
        <div className="loading-state">
          <Loader2 size={48} className="spinner" />
          <p>Đang tải dữ liệu...</p>
        </div>
      </main>
    );
  }

  // Error
  if (error) {
    return (
      <main className="page-container">
        <div className="error-state">
          <AlertTriangle size={48} />
          <h2>Lỗi</h2>
          <p>{error}</p>
          <a href="/upload" className="btn btn--primary">Quay lại Upload</a>
        </div>
      </main>
    );
  }

  if (!student) return null;

  // Stats calculations
  const passedCount = student.grades.filter((g) => g.trang_thai === "DAT").length;
  const failedCount = student.grades.filter((g) => g.trang_thai === "ROT").length;
  const studyingCount = student.grades.filter((g) => g.trang_thai === "DANG_HOC").length;
  const remainingCount = subjects.length - student.grades.length;

  // Tính toán gợi ý môn học
  const passedCourseIds = new Set(
    student.grades.filter((g) => g.trang_thai === "DAT").map((g) => g.subject_code)
  );

  const suggestedSubjects = subjects
    .filter((s) => {
      const grade = student.grades.find((g) => g.subject_code === s.ma_mon);
      // Gợi ý những môn Chưa học, hoặc những môn RỚT
      if (grade && grade.trang_thai !== "ROT") return false;

      // Môn phải đảm bảo đủ điều kiện tiên quyết
      if (!s.prerequisites || s.prerequisites.length === 0) return true;
      return s.prerequisites.every((prereq) => passedCourseIds.has(prereq));
    })
    .sort((a, b) => a.semester_level - b.semester_level) // Ưu tiên môn có kỳ thấp
    .slice(0, 4);

  return (
    <main className="page-container page-container--full">
      {/* Student Info Header */}
      <div className="dashboard-header">
        <div className="student-info">
          <h1 className="student-name">
            <GraduationCap size={28} /> {student.ho_ten}
          </h1>
          <div className="student-meta">
            <span className="badge badge--blue">{student.mssv}</span>
            {student.major && <span className="badge badge--purple">{student.major}</span>}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-card--green">
            <div className="stat-value">{student.current_gpa?.toFixed(2) || "—"}</div>
            <div className="stat-label"><TrendingUp size={14} /> GPA</div>
          </div>
          <div className="stat-card stat-card--emerald">
            <div className="stat-value">{passedCount}</div>
            <div className="stat-label"><BookOpen size={14} /> Đã đạt</div>
          </div>
          <div className="stat-card stat-card--yellow">
            <div className="stat-value">{studyingCount}</div>
            <div className="stat-label">📖 Đang học</div>
          </div>
          <div className="stat-card stat-card--red">
            <div className="stat-value">{failedCount}</div>
            <div className="stat-label">❌ Rớt</div>
          </div>
          <div className="stat-card stat-card--gray">
            <div className="stat-value">{remainingCount}</div>
            <div className="stat-label">⬜ Chưa học</div>
          </div>
        </div>
      </div>

      {/* Next Courses Suggestion Section */}
      {suggestedSubjects.length > 0 && (
        <div style={{ marginBottom: "var(--space-2xl)", animation: "fadeIn 0.8s ease-out" }}>
          <h2 className="section-title">
            <Star size={24} color="#f59e0b" fill="#f59e0b" /> Gợi ý học phần có thể đăng ký kỳ tới
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {suggestedSubjects.map((sub) => {
              const checkFail = student.grades.find(g => g.subject_code === sub.ma_mon)?.trang_thai === "ROT";
              return (
                <div key={sub.ma_mon} style={{
                  background: "rgba(30, 41, 59, 0.4)", border: "1px solid rgba(255,255,255,0.1)",
                  padding: "16px", borderRadius: "16px", backdropFilter: "blur(10px)",
                  display: "flex", flexDirection: "column", gap: "8px",
                  boxShadow: checkFail ? "0 4px 15px rgba(239, 68, 68, 0.15)" : "0 4px 15px rgba(16, 185, 129, 0.1)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, opacity: 0.7 }}>{sub.ma_mon}</span>
                    {checkFail ? (
                      <span className="badge badge--purple" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}>Khuyên học lại</span>
                    ) : (
                      <span className="badge badge--purple" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>Kỳ {sub.semester_level}</span>
                    )}
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#f8fafc", lineHeight: 1.4 }}>{sub.ten_mon}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#94a3b8", marginTop: "auto" }}>
                    <CheckCircle size={14} color="#10b981" /> <span>Đã đủ điều kiện môn tiên quyết</span> ({sub.so_tin_chi} TC)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Roadmap */}
      <div className="dashboard-roadmap">
        <h2 className="section-title">🗺️ Roadmap Lộ Trình Học Tập</h2>
        <RoadmapView subjects={subjects} grades={student.grades} />
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <main className="page-container">
        <div className="loading-state">
          <Loader2 size={48} className="spinner" />
          <p>Đang tải...</p>
        </div>
      </main>
    }>
      <DashboardContent />
    </Suspense>
  );
}

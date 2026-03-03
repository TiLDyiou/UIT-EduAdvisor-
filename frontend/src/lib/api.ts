/**
 * lib/api.ts — API client cho UIT EduAdvisor.
 *
 * Tập trung tất cả API calls vào một file duy nhất.
 * Type definitions cho API responses.
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type GradeStatus = "DAT" | "ROT" | "DANG_HOC";

export interface GradeResponse {
  subject_code: string;
  subject_name: string | null;
  so_tin_chi: number | null;
  diem_so: number | null;
  diem_chu: string | null;
  trang_thai: GradeStatus;
}

export interface StudentResponse {
  mssv: string;
  ho_ten: string;
  major: string | null;
  current_gpa: number | null;
  grades: GradeResponse[];
}

export interface SubjectResponse {
  ma_mon: string;
  ten_mon: string;
  so_tin_chi: number;
  prerequisites: string[] | null;
  semester_level: number;
}

export interface TranscriptUploadResponse {
  success: boolean;
  message: string;
  student: StudentResponse | null;
  total_grades: number;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

// Lấy public base URL để gọi thẳng backend nếu đang dùng Vercel (bỏ qua Rewrite)
// Khi chạy local: dùng "/api" (Next.js rewrite proxy về localhost:8000)
// Khi chạy Vercel: dùng "https://xxx.loca.lt/api" (gọi thẳng backend)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

/**
 * Upload file HTML transcript.
 * Frontend gửi tới /api/upload-transcript → Next.js rewrite tới backend.
 */
export async function uploadTranscript(file: File): Promise<TranscriptUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/upload-transcript`, {
    method: "POST",
    body: formData,
    headers: {
      "bypass-tunnel-reminder": "true",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Lỗi không xác định" }));
    throw new Error(error.detail || `Upload thất bại (${response.status})`);
  }

  return response.json();
}

/**
 * Lấy thông tin sinh viên theo MSSV.
 */
export async function getStudent(mssv: string): Promise<StudentResponse> {
  const response = await fetch(`${API_BASE}/students/${mssv}`, {
    headers: { "bypass-tunnel-reminder": "true" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Không tìm thấy sinh viên với MSSV: ${mssv}`);
    }
    throw new Error(`Lỗi lấy dữ liệu sinh viên (${response.status})`);
  }

  return response.json();
}

/**
 * Lấy danh sách tất cả môn học (cho Roadmap).
 */
export async function getSubjects(): Promise<SubjectResponse[]> {
  const response = await fetch(`${API_BASE}/subjects`, {
    headers: { "bypass-tunnel-reminder": "true" },
  });

  if (!response.ok) {
    throw new Error(`Lỗi lấy danh mục môn học (${response.status})`);
  }

  return response.json();
}

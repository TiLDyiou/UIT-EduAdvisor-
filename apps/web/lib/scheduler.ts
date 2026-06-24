import { apiFormData, apiJson, apiFetch } from "./api";

export interface Section {
  course_code: string;
  section_code: string;
  course_name: string;
  credits: number;
  is_lab: boolean;
  teaching_type: string | null;
  day_of_week: number;
  periods: number[];
  biweekly: boolean;
  room: string | null;
  capacity: number | null;
  instructor_name: string | null;
  start_date: string | null;
  end_date: string | null;
  program: string | null;
  department: string | null;
}

export interface RecommendedCourse {
  course_id: number;
  course_code: string;
  course_name: string;
  credits: number;
  score: number;
  reasons: string[];
  term_number: number | null;
  difficulty: string | null;
}

export interface UploadTkbResponse {
  sections: Section[];
  total: number;
  unique_courses: number;
}

export interface RecommendResponse {
  recommendations: RecommendedCourse[];
}

export interface TimeSlot {
  day: number; // 2-8 (Mon-Sun)
  period: number; // 1-12
}

export interface ScheduleRequest {
  sections: Section[];
  course_codes: string[];
  available_slots: TimeSlot[] | null;
}

export interface SolutionSection {
  course_code: string;
  section_code: string;
  course_name: string;
  day_of_week: number;
  periods: number[];
  room: string | null;
  instructor_name: string | null;
  is_lab: boolean;
}

export interface ScheduleSolution {
  sections: SolutionSection[];
  missing_courses?: string[];
}

export interface ScheduleResponse {
  solutions: ScheduleSolution[];
  warnings: string[];
}

export interface IcsExportRequest {
  sections: Section[];
  term_start: string; // ISO date
  term_weeks: number;
}

export const schedulerService = {
  uploadTkb: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFormData<UploadTkbResponse>("/api/v1/scheduler/upload-tkb", formData);
  },

  getRecommendations: async (availableCourseCodes?: string[]) => {
    return apiJson<RecommendResponse>("/api/v1/scheduler/suggest-courses", {
      method: "POST",
      body: JSON.stringify(availableCourseCodes || null),
    });
  },

  solve: async (request: ScheduleRequest) => {
    return apiJson<ScheduleResponse>("/api/v1/scheduler/solve", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  exportIcs: async (request: IcsExportRequest) => {
    const r = await apiFetch("/api/v1/scheduler/export-ics", {
      method: "POST",
      body: JSON.stringify(request),
    });
    if (!r.ok) {
      throw new Error("export_failed");
    }
    const blob = await r.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uit_tkb.ics";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

"""Pydantic schemas for Milestone 5 – UIT Scheduler."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Section (parsed from Excel)
# ---------------------------------------------------------------------------

class SectionSchema(BaseModel):
    course_code: str
    section_code: str
    course_name: str
    credits: int
    is_lab: bool
    teaching_type: str
    day_of_week: int
    periods: list[int]
    biweekly: bool
    room: str
    capacity: int
    instructor_name: str
    start_date: str
    end_date: str
    program: str
    department: str


class UploadTkbResponse(BaseModel):
    sections: list[SectionSchema]
    total: int
    unique_courses: int


# ---------------------------------------------------------------------------
# Smart Recommendation
# ---------------------------------------------------------------------------

class RecommendedCourseSchema(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    credits: int
    score: int
    reasons: list[str]
    term_number: int
    difficulty: str | None


class RecommendResponse(BaseModel):
    recommendations: list[RecommendedCourseSchema]


# ---------------------------------------------------------------------------
# Schedule Solver
# ---------------------------------------------------------------------------

class AvailableSlot(BaseModel):
    day: int = Field(ge=2, le=7, description="2=Mon … 7=Sat")
    period: int = Field(ge=1, le=13)


class ScheduleRequest(BaseModel):
    course_codes: list[str] = Field(min_length=1)
    sections: list[SectionSchema]
    available_slots: list[AvailableSlot] | None = None


class SolutionSectionSchema(BaseModel):
    course_code: str
    section_code: str
    course_name: str
    day_of_week: int
    periods: list[int]
    room: str
    instructor_name: str
    is_lab: bool


class ScheduleSolution(BaseModel):
    sections: list[SolutionSectionSchema]


class ScheduleResponse(BaseModel):
    solutions: list[ScheduleSolution]
    warnings: list[str]


# ---------------------------------------------------------------------------
# ICS Export
# ---------------------------------------------------------------------------

class IcsExportRequest(BaseModel):
    sections: list[SectionSchema]
    term_start: str = Field(description="ISO date, e.g. 2025-09-08")
    term_weeks: int = Field(default=16, ge=1, le=52)

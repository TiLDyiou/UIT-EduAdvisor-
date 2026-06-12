from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_COURSE_KINDS = {"core", "elective", "thesis", "internship", "general", "foundation", "major", "other", "thesis_internship"}
ALLOWED_COURSE_DIFFICULTIES = {"easy", "medium", "hard"}


def normalize_course_code(value: str) -> str:
    return value.strip().upper()


class AdminCourseBasePayload(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=32)
    name: str = Field(min_length=1, max_length=512)
    credits: int | None = Field(default=None, gt=0, le=20)
    kind: str = Field(min_length=2, max_length=32)
    difficulty: str | None = Field(default=None, max_length=16)

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, value: str | None) -> str | None:
        if not value:
            return None
        return normalize_course_code(value)

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name_required")
        return normalized

    @field_validator("kind")
    @classmethod
    def _normalize_kind(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_COURSE_KINDS:
            raise ValueError("invalid_kind")
        return normalized

    @field_validator("difficulty")
    @classmethod
    def _normalize_difficulty(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in ALLOWED_COURSE_DIFFICULTIES:
            raise ValueError("invalid_difficulty")
        return normalized


class AdminCourseCreateRequest(AdminCourseBasePayload):
    pass


class AdminCourseUpdateRequest(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=512)
    credits: int | None = Field(default=None, gt=0, le=20)
    kind: str | None = Field(default=None, min_length=2, max_length=32)
    difficulty: str | None = Field(default=None, max_length=16)
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, value: str | None) -> str | None:
        if not value:
            return None
        return normalize_course_code(value)

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("name_required")
        return normalized

    @field_validator("kind")
    @classmethod
    def _normalize_kind(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in ALLOWED_COURSE_KINDS:
            raise ValueError("invalid_kind")
        return normalized

    @field_validator("difficulty")
    @classmethod
    def _normalize_difficulty(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in ALLOWED_COURSE_DIFFICULTIES:
            raise ValueError("invalid_difficulty")
        return normalized


class AdminCourseListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str | None
    name: str
    credits: int | None
    kind: str
    difficulty: str | None
    admin_locked: bool
    is_active: bool
    admin_updated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminCourseListResponse(BaseModel):
    items: list[AdminCourseListItem]
    total: int
    limit: int
    offset: int


class CoursePrerequisiteItem(BaseModel):
    prerequisite_id: int
    kind: str = Field(pattern="^(prerequisite|prior)$")


class AdminCourseDetailResponse(AdminCourseListItem):
    prerequisites: list[CoursePrerequisiteItem]


class AdminCoursePrerequisitesRequest(BaseModel):
    prerequisites: list[CoursePrerequisiteItem] = Field(default_factory=list)

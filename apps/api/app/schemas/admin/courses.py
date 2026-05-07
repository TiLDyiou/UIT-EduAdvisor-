from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_COURSE_KINDS = {"core", "elective", "thesis", "internship", "general"}
ALLOWED_COURSE_DIFFICULTIES = {"easy", "medium", "hard"}


def normalize_course_code(value: str) -> str:
    return value.strip().upper()


class AdminCourseBasePayload(BaseModel):
    code: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=1, max_length=512)
    credits: int = Field(gt=0, le=20)
    kind: str = Field(min_length=2, max_length=32)
    difficulty: str | None = Field(default=None, max_length=16)

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, value: str) -> str:
        normalized = normalize_course_code(value)
        if not normalized:
            raise ValueError("code_required")
        return normalized

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

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = normalize_course_code(value)
        if not normalized:
            raise ValueError("code_required")
        return normalized

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
    code: str
    name: str
    credits: int
    kind: str
    difficulty: str | None
    admin_locked: bool
    admin_updated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminCourseListResponse(BaseModel):
    items: list[AdminCourseListItem]
    total: int
    limit: int
    offset: int


class AdminCourseDetailResponse(AdminCourseListItem):
    prerequisite_ids: list[int]


class AdminCoursePrerequisitesRequest(BaseModel):
    prerequisite_ids: list[int] = Field(default_factory=list)

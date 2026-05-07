from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

ALLOWED_ELECTIVE_RULE_TYPES = {"min_credits", "min_courses"}


class AdminCurriculumCreateRequest(BaseModel):
    major_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=512)
    effective_year: int = Field(ge=2000, le=2100)
    total_credits: int = Field(gt=0, le=300)

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name_required")
        return normalized


class AdminCurriculumUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=512)
    effective_year: int | None = Field(default=None, ge=2000, le=2100)
    total_credits: int | None = Field(default=None, gt=0, le=300)

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("name_required")
        return normalized


class AdminCurriculumTermCoursePayload(BaseModel):
    course_id: int = Field(gt=0)
    is_required: bool = True


class AdminCurriculumTermPayload(BaseModel):
    term_number: int = Field(ge=1, le=20)
    courses: list[AdminCurriculumTermCoursePayload] = Field(default_factory=list)


class AdminElectiveGroupPayload(BaseModel):
    id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=1, max_length=255)
    rule_type: str = Field(min_length=3, max_length=16)
    required_value: int = Field(gt=0, le=300)
    course_ids: list[int] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name_required")
        return normalized

    @field_validator("rule_type")
    @classmethod
    def _normalize_rule_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_ELECTIVE_RULE_TYPES:
            raise ValueError("invalid_rule_type")
        return normalized


class AdminCurriculumStructureRequest(BaseModel):
    terms: list[AdminCurriculumTermPayload] = Field(default_factory=list)
    elective_groups: list[AdminElectiveGroupPayload] = Field(default_factory=list)


class AdminCurriculumListItem(BaseModel):
    id: int
    major_id: int
    name: str
    effective_year: int
    total_credits: int


class AdminCurriculumListResponse(BaseModel):
    items: list[AdminCurriculumListItem]
    total: int
    limit: int
    offset: int


class AdminCurriculumTermCourseResponse(BaseModel):
    course_id: int
    is_required: bool


class AdminCurriculumTermResponse(BaseModel):
    id: int
    term_number: int
    courses: list[AdminCurriculumTermCourseResponse]


class AdminElectiveGroupResponse(BaseModel):
    id: int
    name: str
    rule_type: str
    required_value: int
    course_ids: list[int]


class AdminCurriculumDetailResponse(BaseModel):
    id: int
    major_id: int
    name: str
    effective_year: int
    total_credits: int
    terms: list[AdminCurriculumTermResponse]
    elective_groups: list[AdminElectiveGroupResponse]

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_RESOURCE_TYPES = {"slide", "document", "video", "drive", "other"}


class AdminResourceCreateRequest(BaseModel):
    course_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=512)
    url: str = Field(min_length=12, max_length=2048)
    resource_type: str = Field(min_length=2, max_length=32)
    term_code: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    is_visible: bool = True

    @field_validator("title")
    @classmethod
    def _normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("title_required")
        return normalized

    @field_validator("resource_type")
    @classmethod
    def _normalize_resource_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_RESOURCE_TYPES:
            raise ValueError("invalid_resource_type")
        return normalized

    @field_validator("url")
    @classmethod
    def _validate_url(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized.startswith("https://"):
            raise ValueError("https_url_required")
        return normalized


class AdminResourceUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    url: str | None = Field(default=None, min_length=12, max_length=2048)
    resource_type: str | None = Field(default=None, min_length=2, max_length=32)
    term_code: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    is_visible: bool | None = None

    @field_validator("title")
    @classmethod
    def _normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("title_required")
        return normalized

    @field_validator("resource_type")
    @classmethod
    def _normalize_resource_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in ALLOWED_RESOURCE_TYPES:
            raise ValueError("invalid_resource_type")
        return normalized

    @field_validator("url")
    @classmethod
    def _validate_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized.startswith("https://"):
            raise ValueError("https_url_required")
        return normalized


class AdminResourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    url: str
    resource_type: str
    term_code: str | None
    description: str | None
    is_visible: bool
    created_at: datetime
    updated_at: datetime


class AdminResourceListResponse(BaseModel):
    items: list[AdminResourceResponse]
    total: int
    limit: int
    offset: int

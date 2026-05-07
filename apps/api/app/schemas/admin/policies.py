from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class AdminPolicyUploadForm(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    version: str = Field(min_length=1, max_length=64)
    effective_year: int = Field(ge=2000, le=2100)
    tag: str = Field(min_length=2, max_length=32)

    @field_validator("title", "version")
    @classmethod
    def _normalize_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("field_required")
        return normalized

    @field_validator("tag")
    @classmethod
    def _normalize_tag(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("tag_required")
        return normalized


class AdminPolicyResponse(BaseModel):
    id: int
    title: str
    version: str
    effective_year: int
    tag: str
    source_filename: str | None
    mime_type: str | None
    file_size_bytes: int | None
    chunk_count: int
    ingest_job_id: str | None
    uploaded_by: str | None
    uploaded_at: datetime
    is_deprecated: bool
    deprecated_at: datetime | None


class AdminPolicyListResponse(BaseModel):
    items: list[AdminPolicyResponse]
    total: int
    limit: int
    offset: int

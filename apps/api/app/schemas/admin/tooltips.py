from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_keyword(value: str) -> str:
    return " ".join(value.strip().lower().split())


class AdminTooltipCreateRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=128)
    short_explanation: str = Field(min_length=1, max_length=1000)
    policy_document_id: int | None = Field(default=None, gt=0)
    policy_url: str | None = Field(default=None, max_length=2048)
    is_active: bool = True

    @field_validator("keyword")
    @classmethod
    def _normalize_keyword(cls, value: str) -> str:
        normalized = normalize_keyword(value)
        if not normalized:
            raise ValueError("keyword_required")
        return normalized

    @field_validator("short_explanation")
    @classmethod
    def _normalize_explanation(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("short_explanation_required")
        return normalized

    @field_validator("policy_url")
    @classmethod
    def _validate_policy_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if normalized and not normalized.startswith("https://"):
            raise ValueError("https_url_required")
        return normalized or None


class AdminTooltipUpdateRequest(BaseModel):
    keyword: str | None = Field(default=None, min_length=1, max_length=128)
    short_explanation: str | None = Field(default=None, min_length=1, max_length=1000)
    policy_document_id: int | None = Field(default=None, gt=0)
    policy_url: str | None = Field(default=None, max_length=2048)
    is_active: bool | None = None

    @field_validator("keyword")
    @classmethod
    def _normalize_keyword(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = normalize_keyword(value)
        if not normalized:
            raise ValueError("keyword_required")
        return normalized

    @field_validator("short_explanation")
    @classmethod
    def _normalize_explanation(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("short_explanation_required")
        return normalized

    @field_validator("policy_url")
    @classmethod
    def _validate_policy_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if normalized and not normalized.startswith("https://"):
            raise ValueError("https_url_required")
        return normalized or None


class AdminTooltipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    keyword: str
    normalized_keyword: str
    short_explanation: str
    policy_document_id: int | None
    policy_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AdminTooltipListResponse(BaseModel):
    items: list[AdminTooltipResponse]
    total: int
    limit: int
    offset: int


class PublicTooltipResponse(BaseModel):
    keyword: str
    short_explanation: str
    policy_url: str | None

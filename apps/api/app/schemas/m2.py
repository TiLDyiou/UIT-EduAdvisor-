"""Pydantic schemas for Milestone 2 onboarding and sync."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


class DaaCaptchaResponse(BaseModel):
    captcha_state_id: str
    question: str
    image_base64: str | None = None


class OnboardingStartRequest(BaseModel):
    student_code: str = Field(min_length=4, max_length=32)
    password: str = Field(min_length=1, max_length=256)
    captcha_state_id: str = Field(min_length=8, max_length=128)
    captcha_answer: str = Field(min_length=1, max_length=128)
    privacy_accepted: bool = False
    tos_accepted: bool = False


class OnboardingStartResponse(BaseModel):
    job_id: uuid.UUID
    student_id: uuid.UUID


class MeResponse(BaseModel):
    student_id: uuid.UUID
    student_code_masked: str
    has_credential: bool
    csrf_token: str


class SyncEvent(BaseModel):
    stage: str
    progress_percent: int
    message: str | None = None
    detail: dict[str, Any] | None = None

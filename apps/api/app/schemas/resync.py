"""Pydantic schemas for DAA re-sync (on-demand)."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class ResyncDaaRequest(BaseModel):
    captcha_state_id: str = Field(min_length=8, max_length=128)
    captcha_answer: str = Field(min_length=1, max_length=128)


class ResyncDaaResponse(BaseModel):
    job_id: uuid.UUID

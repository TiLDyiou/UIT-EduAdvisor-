"""Pydantic schemas for Milestone 7 -- Remote Bot."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Platform = Literal["discord", "mail"]


# ---------------------------------------------------------------------------
# Link token
# ---------------------------------------------------------------------------


class LinkTokenCreateRequest(BaseModel):
    platform: Platform


class LinkTokenResponse(BaseModel):
    token: str
    expires_at: datetime
    deep_link: str


# ---------------------------------------------------------------------------
# Bot accounts
# ---------------------------------------------------------------------------


class BotAccountResponse(BaseModel):
    platform: str
    platform_user_id: str
    linked_at: datetime
    unlinked_at: datetime | None = None


# ---------------------------------------------------------------------------
# Reminder preferences
# ---------------------------------------------------------------------------


class ReminderPreferenceResponse(BaseModel):
    exam_reminder: bool
    deadline_reminder: bool


class ReminderPreferenceUpdateRequest(BaseModel):
    exam_reminder: bool
    deadline_reminder: bool


# ---------------------------------------------------------------------------
# Internal: normalized command from any platform
# ---------------------------------------------------------------------------


class NormalizedCommand(BaseModel):
    """Platform-agnostic representation of a bot command."""

    platform: Platform
    platform_user_id: str
    command: str = Field(description="e.g. '/tkb', '/gpa', '/start'")
    args: str = Field(default="", description="Everything after the command")

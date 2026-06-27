from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AiMateChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    client_thread_id: str | None = Field(default=None, max_length=128)


class PolicySourceMeta(BaseModel):
    document_id: int
    document_title: str
    tag: str
    chunk_index: int
    content: str | None = None
    url: str | None = None
    page_number: int | None = None


class AiMateMetaEvent(BaseModel):
    request_id: str
    remaining_messages: int
    sources: list[PolicySourceMeta]


class AiMateDeltaEvent(BaseModel):
    text: str


class AiMateDoneEvent(BaseModel):
    policy_disclaimer_required: bool = False


class AiMateErrorEvent(BaseModel):
    code: str
    message: str


class ChatSummaryOut(BaseModel):
    id: UUID
    session_started_at: datetime
    courses_of_interest: list[str]
    recent_questions: list[str]
    created_at: datetime
    expires_at: datetime


class TranscriptMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class SummaryCreateRequest(BaseModel):
    session_started_at: datetime
    messages: list[TranscriptMessage] = Field(default_factory=list, max_length=200)


class PinnedMessageOut(BaseModel):
    id: UUID
    content: str
    created_at: datetime


class PinnedCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

"""RAG policy chunks + AI Mate summaries and pinned messages."""

from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.core_security import AdminUser, Student
from app.db.models.mixins import BigIntPkMixin, UUIDPkMixin


class PolicyDocument(BigIntPkMixin, Base):
    __tablename__ = "policy_documents"

    title: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(Text, nullable=False)
    effective_year: Mapped[int] = mapped_column(Integer, nullable=False)
    tag: Mapped[str] = mapped_column(String(32), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_deprecated: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    deprecated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    uploaded_by_admin: Mapped[AdminUser | None] = relationship()
    chunks: Mapped[list[PolicyChunk]] = relationship(back_populates="document")


class PolicyChunk(BigIntPkMixin, Base):
    __tablename__ = "policy_chunks"

    document_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("policy_documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)

    document: Mapped[PolicyDocument] = relationship(back_populates="chunks")


class ChatSummary(UUIDPkMixin, Base):
    __tablename__ = "chat_summaries"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    courses_of_interest: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )
    recent_questions: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    student: Mapped[Student] = relationship()


class PinnedMessage(UUIDPkMixin, Base):
    __tablename__ = "pinned_messages"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    student: Mapped[Student] = relationship()

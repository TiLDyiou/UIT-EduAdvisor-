"""Core schema: majors, students, credentials, consent, admin, audit, sync jobs."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import BigIntPkMixin, TimestampMixin, TimestampUpdateMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.db.models.academic import Curriculum


class Major(BigIntPkMixin, TimestampMixin, Base):
    __tablename__ = "majors"

    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)

    students: Mapped[list[Student]] = relationship(back_populates="major")
    curricula: Mapped[list[Curriculum]] = relationship(back_populates="major")


class Student(UUIDPkMixin, TimestampUpdateMixin, Base):
    __tablename__ = "students"

    student_code_ciphertext: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    full_name_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    major_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("majors.id"), nullable=False)
    enrollment_year: Mapped[int] = mapped_column(Integer, nullable=False)

    major: Mapped[Major] = relationship(back_populates="students")
    consent_records: Mapped[list[ConsentRecord]] = relationship(back_populates="student")
    credentials: Mapped[StudentCredential | None] = relationship(
        back_populates="student",
        uselist=False,
    )


class ConsentRecord(UUIDPkMixin, Base):
    __tablename__ = "consent_records"

    student_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=True,
    )
    privacy_policy_version: Mapped[str] = mapped_column(Text, nullable=False)
    tos_version: Mapped[str] = mapped_column(Text, nullable=False)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    student: Mapped[Student | None] = relationship(back_populates="consent_records")
    credentials: Mapped[list[StudentCredential]] = relationship(back_populates="consent")


class StudentCredential(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "student_credentials"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    password_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    key_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    consent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consent_records.id", ondelete="RESTRICT"),
        nullable=False,
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    student: Mapped[Student] = relationship(back_populates="credentials")
    consent: Mapped[ConsentRecord] = relationship(back_populates="credentials")


class AdminUser(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "admin_users"

    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(UUIDPkMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_actor_created", "actor_id", "created_at"),)

    actor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    target_type: Mapped[str] = mapped_column(Text, nullable=False)
    target_id: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SyncJob(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "sync_jobs"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    progress_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

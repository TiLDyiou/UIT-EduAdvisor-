from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.rag_chat import ChatSummary, PinnedMessage


async def purge_expired_summaries(db: AsyncSession) -> int:
    now = datetime.now(UTC)
    res = await db.execute(delete(ChatSummary).where(ChatSummary.expires_at < now))
    await db.flush()
    return res.rowcount or 0


async def list_summaries(db: AsyncSession, student_id: UUID, settings: Settings) -> list[ChatSummary]:
    await purge_expired_summaries(db)
    now = datetime.now(UTC)
    res = await db.execute(
        select(ChatSummary)
        .where(ChatSummary.student_id == student_id, ChatSummary.expires_at > now)
        .order_by(ChatSummary.created_at.desc())
    )
    return list(res.scalars().all())


async def create_summary(
    db: AsyncSession,
    *,
    student_id: UUID,
    session_started_at: datetime,
    courses_of_interest: list[str],
    recent_questions: list[str],
    settings: Settings,
) -> ChatSummary:
    now = datetime.now(UTC)
    if session_started_at.tzinfo is None:
        session_started_at = session_started_at.replace(tzinfo=UTC)
    row = ChatSummary(
        student_id=student_id,
        session_started_at=session_started_at,
        courses_of_interest=courses_of_interest[:16],
        recent_questions=recent_questions[:16],
        created_at=now,
        expires_at=now + timedelta(days=settings.ai_summary_retention_days),
    )
    db.add(row)
    await db.flush()
    return row


async def delete_summary(db: AsyncSession, student_id: UUID, summary_id: UUID) -> bool:
    res = await db.execute(
        delete(ChatSummary).where(ChatSummary.id == summary_id, ChatSummary.student_id == student_id)
    )
    await db.flush()
    return (res.rowcount or 0) > 0


async def list_pins(db: AsyncSession, student_id: UUID) -> list[PinnedMessage]:
    res = await db.execute(
        select(PinnedMessage)
        .where(PinnedMessage.student_id == student_id)
        .order_by(PinnedMessage.created_at.desc())
    )
    return list(res.scalars().all())


async def create_pin(db: AsyncSession, *, student_id: UUID, content: str) -> PinnedMessage:
    now = datetime.now(UTC)
    row = PinnedMessage(student_id=student_id, content=content, created_at=now)
    db.add(row)
    await db.flush()
    return row


async def delete_pin(db: AsyncSession, student_id: UUID, pin_id: UUID) -> bool:
    res = await db.execute(
        delete(PinnedMessage).where(PinnedMessage.id == pin_id, PinnedMessage.student_id == student_id)
    )
    await db.flush()
    return (res.rowcount or 0) > 0


async def delete_all_ai_memory(db: AsyncSession, student_id: UUID) -> tuple[int, int]:
    r1 = await db.execute(delete(ChatSummary).where(ChatSummary.student_id == student_id))
    r2 = await db.execute(delete(PinnedMessage).where(PinnedMessage.student_id == student_id))
    await db.flush()
    return (r1.rowcount or 0, r2.rowcount or 0)

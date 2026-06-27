"""Consent recording and active-consent checks."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.core_security import ConsentRecord


async def record_consent(
    session: AsyncSession,
    *,
    student_id: uuid.UUID | None,
    privacy_policy_version: str,
    tos_version: str,
    consented_at: datetime,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> ConsentRecord:
    row = ConsentRecord(
        student_id=student_id,
        privacy_policy_version=privacy_policy_version,
        tos_version=tos_version,
        consented_at=consented_at,
        ip_address=ip_address,
        user_agent=user_agent,
        revoked_at=None,
    )
    session.add(row)
    await session.flush()
    return row


async def has_active_consent(
    session: AsyncSession,
    student_id: uuid.UUID,
    *,
    expected_privacy_version: str,
    expected_tos_version: str,
) -> bool:
    stmt = (
        select(ConsentRecord)
        .where(ConsentRecord.student_id == student_id)
        .where(ConsentRecord.revoked_at.is_(None))
        .order_by(ConsentRecord.consented_at.desc())
        .limit(1)
    )
    res = await session.execute(stmt)
    row = res.scalar_one_or_none()
    if row is None:
        return False
    return (
        row.privacy_policy_version == expected_privacy_version
        and row.tos_version == expected_tos_version
    )


async def revoke_consent(
    session: AsyncSession, consent_id: uuid.UUID, revoked_at: datetime
) -> None:
    stmt = select(ConsentRecord).where(ConsentRecord.id == consent_id).limit(1)
    res = await session.execute(stmt)
    row = res.scalar_one_or_none()
    if row is None:
        return
    row.revoked_at = revoked_at
    await session.flush()


def consent_guard_ok(
    *,
    privacy_accepted: bool,
    tos_accepted: bool,
    extra: dict[str, Any] | None = None,
) -> bool:
    """Placeholder guard for API layers (M2+). Both flags must be true."""
    _ = extra
    return bool(privacy_accepted and tos_accepted)

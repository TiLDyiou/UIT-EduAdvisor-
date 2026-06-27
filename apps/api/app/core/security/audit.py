"""Audit log writes for admin (and later student) actions."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.core_security import AuditLog


async def record_audit(
    session: AsyncSession,
    *,
    actor_type: str,
    actor_id: uuid.UUID | None,
    action: str,
    target_type: str,
    target_id: str,
    payload: dict[str, Any] | None = None,
    ip_address: str | None = None,
    created_at: datetime | None = None,
) -> AuditLog:
    row = AuditLog(
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        payload=payload,
        ip_address=ip_address,
        created_at=created_at or datetime.now(UTC),
    )
    session.add(row)
    await session.flush()
    return row

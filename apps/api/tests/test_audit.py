"""Integration tests: audit log persistence."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.core.security.audit import record_audit
from app.db.models.core_security import AuditLog

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_record_audit_round_trip(db_session) -> None:
    aid = uuid.uuid4()
    payload = {"before": 1, "after": 2}
    await record_audit(
        db_session,
        actor_type="admin",
        actor_id=aid,
        action="course.delete",
        target_type="course",
        target_id="CS101",
        payload=payload,
        ip_address="127.0.0.1",
    )
    await db_session.commit()

    res = await db_session.execute(select(AuditLog).where(AuditLog.actor_id == aid).limit(1))
    row = res.scalar_one()
    assert row.action == "course.delete"
    assert row.payload == payload

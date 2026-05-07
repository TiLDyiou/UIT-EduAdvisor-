"""Regression tests for DAA sync vs admin-managed course fields."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.db.models.academic import Course
from app.services.sync.onboarding_sync import _ensure_course

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_ensure_course_updates_unlocked_course(db_session) -> None:
    course = Course(
        code="CS100",
        name="Old Name",
        credits=2,
        kind="daa",
        admin_locked=False,
    )
    db_session.add(course)
    await db_session.commit()

    await _ensure_course(db_session, "CS100", "New Name", 4)
    await db_session.commit()

    res = await db_session.execute(select(Course).where(Course.code == "CS100").limit(1))
    refreshed = res.scalar_one()
    assert refreshed.name == "New Name"
    assert refreshed.credits == 4


@pytest.mark.asyncio
async def test_ensure_course_does_not_override_admin_locked_course(db_session) -> None:
    course = Course(
        code="CS200",
        name="Admin Name",
        credits=3,
        kind="required",
        difficulty="hard",
        admin_locked=True,
    )
    db_session.add(course)
    await db_session.commit()

    await _ensure_course(db_session, "CS200", "DAA Name", 5)
    await db_session.commit()

    res = await db_session.execute(select(Course).where(Course.code == "CS200").limit(1))
    refreshed = res.scalar_one()
    assert refreshed.name == "Admin Name"
    assert refreshed.credits == 3
    assert refreshed.kind == "required"
    assert refreshed.difficulty == "hard"

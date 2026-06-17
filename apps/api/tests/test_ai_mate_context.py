from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.db.models.academic import Course, Enrollment
from app.db.models.core_security import Major, Student
from app.services.ai_mate import context as ai_context

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_build_realtime_context_includes_gpa_and_courses(db_session) -> None:
    major = Major(code="SE", name="Software")
    db_session.add(major)
    await db_session.flush()
    sid = uuid.uuid4()
    st = Student(
        id=sid,
        student_code_ciphertext="vault:stub",
        full_name_ciphertext="vault:stub",
        major_id=major.id,
        enrollment_year=2023,
    )
    db_session.add(st)
    await db_session.flush()
    c = Course(code="CS100", name="Intro", credits=3, kind="required", admin_locked=False)
    db_session.add(c)
    await db_session.flush()
    c2 = Course(code="CS101", name="Data", credits=3, kind="required", admin_locked=False)
    db_session.add(c2)
    await db_session.flush()
    db_session.add(
        Enrollment(
            student_id=sid,
            course_id=c.id,
            term_code="HK241",
            status="done",
            final_grade_10=Decimal("8.0"),
        )
    )
    db_session.add(
        Enrollment(
            student_id=sid,
            course_id=c2.id,
            term_code="HK242",
            status="studying",
            final_grade_10=None,
        )
    )
    await db_session.commit()

    res = await db_session.execute(select(Student).where(Student.id == sid).limit(1))
    student = res.scalar_one()
    block = await ai_context.build_realtime_context_block(db_session, student)
    assert "Software" in block or "SE" in block
    assert "GPA" in block
    assert "HK242" in block or "đang học" in block

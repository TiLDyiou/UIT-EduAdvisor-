from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from datetime import date, datetime, time, timedelta, timezone

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.core.sessions import create_student_session
from app.db.models.academic import Course, Deadline, Exam
from app.db.models.core_security import Major, Student
from app.deps import get_db, get_redis

pytestmark = pytest.mark.integration


async def _make_student(db_session, code: str) -> Student:
    major = Major(code=code, name=code)
    db_session.add(major)
    await db_session.flush()
    sid = uuid.uuid4()
    cipher = f"vault:stub:{code}:{sid}"
    st = Student(
        id=sid,
        student_code_ciphertext=cipher,
        full_name_ciphertext=cipher,
        major_id=major.id,
        enrollment_year=2024,
    )
    db_session.add(st)
    await db_session.commit()
    await db_session.refresh(st)
    return st


@pytest_asyncio.fixture
async def app(db_session, redis_async_client) -> AsyncIterator[FastAPI]:
    await redis_async_client.flushdb()
    app = FastAPI()
    app.include_router(v1_router, prefix="/api/v1")

    async def _override_db():
        yield db_session

    def _override_redis():
        return redis_async_client

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_redis] = _override_redis
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_get_exams_and_deadlines(client, redis_async_client, db_session) -> None:
    st = await _make_student(db_session, "KHMT")
    token, csrf = await create_student_session(
        redis_async_client, student_id=st.id, ttl_seconds=300
    )
    client.cookies.set("uea_session", token)

    # 1. Create a Course
    c = Course(code="IT003", name="Cau truc du lieu", credits=3, kind="required")
    db_session.add(c)
    await db_session.flush()

    # 2. Create an Exam for the student
    exam = Exam(
        student_id=st.id,
        course_id=c.id,
        term_code="HK2_2025-2026",
        exam_date=date.today() + timedelta(days=5),
        start_time=time(7, 30),
        end_time=time(9, 30),
        room="C301",
        kind="Cuoi ky",
    )
    db_session.add(exam)

    # 3. Create a Deadline for the student
    deadline = Deadline(
        student_id=st.id,
        course_id=c.id,
        title="Nop code Lab 5",
        due_at=datetime.now(timezone.utc) + timedelta(days=2),
        source="moodle",
        source_url="https://moodle.uit.edu.vn",
    )
    db_session.add(deadline)
    await db_session.commit()

    # Get Exams
    r_exams = await client.get("/api/v1/tracker/exams")
    assert r_exams.status_code == 200
    exams_data = r_exams.json()
    assert len(exams_data) == 1
    assert exams_data[0]["course_code"] == "IT003"
    assert exams_data[0]["course_name"] == "Cau truc du lieu"
    assert exams_data[0]["room"] == "C301"
    assert exams_data[0]["kind"] == "Cuoi ky"

    # Get Deadlines
    r_deadlines = await client.get("/api/v1/tracker/deadlines")
    assert r_deadlines.status_code == 200
    deadlines_data = r_deadlines.json()
    assert len(deadlines_data) == 1
    assert deadlines_data[0]["course_code"] == "IT003"
    assert deadlines_data[0]["course_name"] == "Cau truc du lieu"
    assert deadlines_data[0]["title"] == "Nop code Lab 5"
    assert deadlines_data[0]["source"] == "moodle"

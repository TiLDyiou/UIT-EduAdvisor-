from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.core.sessions import create_student_session
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
async def test_pin_create_list_delete(client, redis_async_client, db_session) -> None:
    st = await _make_student(db_session, "P1")
    token, csrf = await create_student_session(
        redis_async_client, student_id=st.id, ttl_seconds=300
    )
    client.cookies.set("uea_session", token)

    r = await client.post(
        "/api/v1/ai-mate/pins",
        headers={"X-CSRF-Token": csrf},
        json={"content": "  remember this  "},
    )
    assert r.status_code == 201
    pid = r.json()["id"]

    lst = await client.get("/api/v1/ai-mate/pins")
    assert lst.status_code == 200
    assert len(lst.json()) == 1

    bad = await client.delete(
        f"/api/v1/ai-mate/pins/{pid}",
        headers={"X-CSRF-Token": "wrong"},
    )
    assert bad.status_code == 403

    st2 = await _make_student(db_session, "P2")
    token2, csrf2 = await create_student_session(
        redis_async_client, student_id=st2.id, ttl_seconds=300
    )
    client.cookies.set("uea_session", token2)
    other = await client.delete(
        f"/api/v1/ai-mate/pins/{pid}",
        headers={"X-CSRF-Token": csrf2},
    )
    assert other.status_code == 404

    client.cookies.set("uea_session", token)
    ok = await client.delete(
        f"/api/v1/ai-mate/pins/{pid}",
        headers={"X-CSRF-Token": csrf},
    )
    assert ok.status_code == 204

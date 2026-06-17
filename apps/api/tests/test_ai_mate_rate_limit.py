from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from unittest.mock import patch

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

from app.api.v1 import ai_mate as ai_mate_module
from app.api.v1.router import router as v1_router
from app.core.sessions import create_student_session
from app.db.models.core_security import Major, Student
from app.deps import get_db, get_redis

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def student_row(db_session) -> Student:
    major = Major(code="RL", name="Rate limit")
    db_session.add(major)
    await db_session.flush()
    sid = uuid.uuid4()
    st = Student(
        id=sid,
        student_code_ciphertext="vault:stub",
        full_name_ciphertext="vault:stub",
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
async def test_chat_stream_429_after_limit(client, redis_async_client, student_row) -> None:
    token, _csrf = await create_student_session(
        redis_async_client, student_id=student_row.id, ttl_seconds=300
    )
    client.cookies.set("uea_session", token)

    n = {"v": 0}

    async def fake_check(self, key, limit, window_seconds):
        n["v"] += 1
        if n["v"] <= 2:
            return True, 2 - n["v"], window_seconds
        return False, 0, 33

    with patch.object(ai_mate_module.RateLimiter, "check", new=fake_check):
        r1 = await client.post(
            "/api/v1/ai-mate/chat/stream",
            json={"message": "hello"},
        )
        r2 = await client.post(
            "/api/v1/ai-mate/chat/stream",
            json={"message": "hello2"},
        )
        r3 = await client.post(
            "/api/v1/ai-mate/chat/stream",
            json={"message": "hello3"},
        )
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r3.status_code == 429
    body = r3.json()
    assert body["detail"]["error"] == "ai_rate_limited"
    assert body["detail"]["reset_in_seconds"] == 33

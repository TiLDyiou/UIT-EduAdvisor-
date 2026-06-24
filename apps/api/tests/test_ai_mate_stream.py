from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
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
    major = Major(code="ST", name="Stream")
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


async def _fake_stream(*args, **kwargs):
    yield "Xin "
    yield "chào"


@pytest.mark.asyncio
async def test_chat_stream_emits_meta_delta_done(client, redis_async_client, student_row, monkeypatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-key-not-used")
    from app.core.config import get_settings

    get_settings.cache_clear()

    token, _ = await create_student_session(
        redis_async_client, student_id=student_row.id, ttl_seconds=300
    )
    client.cookies.set("uea_session", token)

    with patch.object(ai_mate_module, "stream_generate_content", new=_fake_stream):
        r = await client.post("/api/v1/ai-mate/chat/stream", json={"message": "hi"})
    assert r.status_code == 200
    text = r.text
    assert "event: meta" in text
    assert "event: delta" in text
    assert "event: done" in text
    assert "Xin" in text


@pytest.mark.asyncio
async def test_summaries_post_stores_structured_only(client, redis_async_client, student_row) -> None:
    token, csrf = await create_student_session(
        redis_async_client, student_id=student_row.id, ttl_seconds=300
    )
    client.cookies.set("uea_session", token)

    async def fake_json(*args, **kwargs):
        return '{"courses_of_interest":["CS100"],"recent_questions":["đăng ký môn"]}'

    with patch.object(ai_mate_module, "generate_json_text", new=fake_json):
        r = await client.post(
            "/api/v1/ai-mate/summaries",
            headers={"X-CSRF-Token": csrf},
            json={
                "session_started_at": datetime.now(UTC).isoformat(),
                "messages": [{"role": "user", "content": "secret transcript line"}],
            },
        )
    assert r.status_code == 201
    data = r.json()
    assert "CS100" in data["courses_of_interest"]
    assert "secret transcript line" not in data["courses_of_interest"]
    assert "secret" not in str(data["recent_questions"])

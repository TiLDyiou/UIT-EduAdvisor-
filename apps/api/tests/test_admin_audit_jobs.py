from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.core.security.passwords import hash_password
from app.db.models.core_security import AdminJob, AdminUser
from app.deps import get_db, get_redis

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def admin_user(db_session) -> AdminUser:
    row = AdminUser(email="admin@uit.local", password_hash=hash_password("correct-horse-12"))
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return row


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


async def _admin_login_and_csrf(client: httpx.AsyncClient, admin_user: AdminUser) -> str:
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"email": admin_user.email, "password": "correct-horse-12"},
    )
    assert login.status_code == 204
    me = await client.get("/api/v1/admin/me")
    assert me.status_code == 200
    return me.json()["csrf_token"]


async def test_list_jobs_and_audit_logs(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    job = AdminJob(
        kind="exam_schedule_import",
        status="queued",
        created_by=admin_user.id,
        current_stage="queued",
        progress_percent=0,
        created_at=datetime.now(UTC),
    )
    db_session.add(job)
    await db_session.commit()

    jobs = await client.get("/api/v1/admin/jobs", params={"kind": "exam_schedule_import"})
    assert jobs.status_code == 200
    assert len(jobs.json()) >= 1

    # Trigger 1 audit entry.
    r = await client.post(
        "/api/v1/admin/imports/exam-schedules",
        files={"file": ("dummy.xlsx", b"not-really-xlsx", "application/octet-stream")},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code in {202, 422}

    audits = await client.get("/api/v1/admin/audit-logs", params={"action": "admin.import.uploaded"})
    assert audits.status_code == 200
    assert "items" in audits.json()

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import select

from app.api.v1.router import router as v1_router
from app.core.security.passwords import hash_password
from app.db.models.core_security import AdminJob, AdminUser
from app.db.models.rag_chat import PolicyDocument
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


async def test_policy_upload_creates_job_and_document(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    files = {"file": ("policy-v1.pdf", b"%PDF-1.4 test file", "application/pdf")}
    data = {"title": "QD", "tag": "other"}
    r = await client.post(
        "/api/v1/admin/policies/upload",
        data=data,
        files=files,
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 202
    job_id = r.json()["id"]

    job_q = await db_session.execute(select(AdminJob).where(AdminJob.id == job_id))
    assert job_q.scalar_one_or_none() is not None
    doc_q = await db_session.execute(select(PolicyDocument).where(PolicyDocument.title == "QD"))
    assert doc_q.scalar_one_or_none() is not None


async def test_policy_upload_accepts_octet_stream_when_extension_ok(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    files = {"file": ("policy-v1.pdf", b"%PDF-1.4 test file", "application/octet-stream")}
    r = await client.post(
        "/api/v1/admin/policies/upload",
        data={"title": "Octet PDF", "tag": "other"},
        files=files,
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 202


async def test_policy_delete_removes_document(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    up = await client.post(
        "/api/v1/admin/policies/upload",
        data={"title": "To delete", "tag": "other"},
        files={"file": ("x.pdf", b"%PDF-1.4 x", "application/pdf")},
        headers={"X-CSRF-Token": csrf},
    )
    assert up.status_code == 202
    doc_q = await db_session.execute(select(PolicyDocument).where(PolicyDocument.title == "To delete"))
    doc = doc_q.scalar_one()

    r = await client.delete(
        f"/api/v1/admin/policies/{doc.id}",
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 204

    gone = await db_session.execute(select(PolicyDocument).where(PolicyDocument.id == doc.id))
    assert gone.scalar_one_or_none() is None


async def test_import_upload_enqueues_job(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    files = {"file": ("offering.xlsx", b"dummy", "application/vnd.ms-excel")}
    r = await client.post(
        "/api/v1/admin/imports/course-offerings",
        files=files,
        headers={"X-CSRF-Token": csrf},
    )
    # Hardening mới: file .xlsx không hợp lệ sẽ bị reject sớm.
    assert r.status_code == 422
    assert r.json()["detail"]["error"] == "invalid_xlsx_file"

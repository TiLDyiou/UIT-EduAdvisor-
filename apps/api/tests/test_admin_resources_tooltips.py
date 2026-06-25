from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import select

from app.api.v1.router import router as v1_router
from app.core.security.passwords import hash_password
from app.db.models.academic import CourseResource, TooltipTerm
from app.db.models.core_security import AdminUser, AuditLog
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


async def _create_course(client: httpx.AsyncClient, csrf: str, code: str, name: str) -> int:
    r = await client.post(
        "/api/v1/admin/courses",
        json={"code": code, "name": name, "credits": 3, "kind": "core", "difficulty": "easy"},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 201
    return r.json()["id"]


async def test_admin_resource_crud_and_filter(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    course_id = await _create_course(client, csrf, "IT301", "Kien truc PM")

    created = await client.post(
        "/api/v1/admin/resources",
        json={
            "course_id": course_id,
            "title": "Slide week 1",
            "url": "https://drive.google.com/file/abc",
            "resource_type": "drive",
            "term_code": "2026-1",
            "description": "slide intro",
            "is_visible": True,
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 201
    resource_id = created.json()["id"]

    listed = await client.get(
        "/api/v1/admin/resources", params={"course_id": course_id, "visible": True}
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    patched = await client.patch(
        f"/api/v1/admin/resources/{resource_id}",
        json={"is_visible": False},
        headers={"X-CSRF-Token": csrf},
    )
    assert patched.status_code == 200
    assert patched.json()["is_visible"] is False

    row = await db_session.execute(select(CourseResource).where(CourseResource.id == resource_id))
    assert row.scalar_one().is_visible is False

    logs = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "admin.resource.updated")
    )
    assert len(list(logs.scalars().all())) == 1


async def test_admin_tooltip_crud_and_public_endpoint(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    policy = PolicyDocument(
        title="QD 1",
        tag="general",
        file_path="/private/policy-v1.pdf",
        source_filename="policy-v1.pdf",
        mime_type="application/pdf",
        file_size_bytes=1234,
        uploaded_by=admin_user.id,
        uploaded_at=datetime.now(UTC),
        is_deprecated=False,
    )
    db_session.add(policy)
    await db_session.commit()
    await db_session.refresh(policy)

    created = await client.post(
        "/api/v1/admin/tooltips",
        json={
            "keyword": " Hoc phi ",
            "short_explanation": "Giai thich hoc phi",
            "policy_document_id": policy.id,
            "policy_url": "https://example.com/policy",
            "is_active": True,
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 201
    tooltip_id = created.json()["id"]
    assert created.json()["normalized_keyword"] == "hoc phi"

    dup = await client.post(
        "/api/v1/admin/tooltips",
        json={
            "keyword": "hoc  phi",
            "short_explanation": "dup",
            "is_active": True,
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert dup.status_code == 409
    await db_session.rollback()
    rows = await db_session.execute(select(TooltipTerm).where(TooltipTerm.id == tooltip_id))
    assert rows.scalar_one().is_active is True

    patched = await client.patch(
        f"/api/v1/admin/tooltips/{tooltip_id}",
        json={"is_active": False},
        headers={"X-CSRF-Token": csrf},
    )
    assert patched.status_code == 200
    assert patched.json()["is_active"] is False

    public_active = await client.get("/api/v1/tooltips")
    assert public_active.status_code == 200
    assert public_active.json() == []

    public_all = await client.get("/api/v1/tooltips", params={"active": False})
    assert public_all.status_code == 200
    assert len(public_all.json()) >= 1

    logs = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "admin.tooltip.updated")
    )
    assert len(list(logs.scalars().all())) == 1

"""Integration tests admin auth (M4 Pha 1).

Bao trùm:
- login wrong email/password đều trả invalid_credentials (không leak)
- login OK set cookie admin
- /me 401 khi không cookie hoặc cookie student
- logout revoke session, yêu cầu CSRF
- audit log cho login/logout

Dùng httpx.AsyncClient + ASGITransport để DB session, Redis client và
FastAPI app cùng chạy trên một event loop (tránh
"Future attached to a different loop" khi TestClient sync gọi async deps).
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import select

from app.api.v1.admin.router import router as admin_router
from app.core.security.passwords import hash_password
from app.core.sessions import create_student_session
from app.db.models.core_security import AdminUser, AuditLog
from app.deps import get_db, get_redis

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def admin_user(db_session) -> AdminUser:
    admin = AdminUser(email="admin@uit.local", password_hash=hash_password("correct-horse-12"))
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


@pytest_asyncio.fixture
async def app(db_session, redis_async_client) -> AsyncIterator[FastAPI]:
    # Redis sạch để rate limit + sessions không nhiễm test trước.
    await redis_async_client.flushdb()
    app = FastAPI()
    app.include_router(admin_router, prefix="/api/v1")

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


async def _login(client: httpx.AsyncClient, email: str, password: str) -> httpx.Response:
    return await client.post(
        "/api/v1/admin/auth/login", json={"email": email, "password": password}
    )


async def test_login_unknown_email_returns_invalid_credentials(client) -> None:
    r = await _login(client, "ghost@uit.local", "whatever-pass")
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid_credentials"


async def test_login_wrong_password_returns_same_error(client, admin_user) -> None:
    r = await _login(client, admin_user.email, "wrong-password-xx")
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid_credentials"


async def test_login_ok_sets_admin_cookie(client, admin_user) -> None:
    r = await _login(client, admin_user.email, "correct-horse-12")
    assert r.status_code == 204
    assert "uea_admin_session" in r.cookies


async def test_login_writes_audit_log(client, admin_user, db_session) -> None:
    r = await _login(client, admin_user.email, "correct-horse-12")
    assert r.status_code == 204
    res = await db_session.execute(select(AuditLog).where(AuditLog.action == "admin.session.login"))
    rows = list(res.scalars().all())
    assert len(rows) == 1
    assert rows[0].actor_id == admin_user.id


async def test_me_without_cookie_returns_401(client) -> None:
    r = await client.get("/api/v1/admin/me")
    assert r.status_code == 401


async def test_me_with_student_cookie_returns_401(client, redis_async_client) -> None:
    """Cookie student không impersonate được admin (tách scope cookie name)."""
    student_token, _ = await create_student_session(
        redis_async_client, student_id=uuid.uuid4(), ttl_seconds=300
    )
    client.cookies.set("uea_session", student_token)
    r = await client.get("/api/v1/admin/me")
    assert r.status_code == 401


async def test_me_with_admin_cookie_returns_csrf(client, admin_user) -> None:
    login = await _login(client, admin_user.email, "correct-horse-12")
    assert login.status_code == 204
    r = await client.get("/api/v1/admin/me")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == admin_user.email
    assert isinstance(body["csrf_token"], str) and len(body["csrf_token"]) > 0


async def test_logout_requires_csrf(client, admin_user) -> None:
    await _login(client, admin_user.email, "correct-horse-12")
    r = await client.post("/api/v1/admin/auth/logout")
    assert r.status_code == 403
    assert r.json()["detail"] == "csrf_failed"


async def test_logout_with_csrf_revokes_session(client, admin_user) -> None:
    await _login(client, admin_user.email, "correct-horse-12")
    me = (await client.get("/api/v1/admin/me")).json()

    r = await client.post("/api/v1/admin/auth/logout", headers={"X-CSRF-Token": me["csrf_token"]})
    assert r.status_code == 204

    after = await client.get("/api/v1/admin/me")
    assert after.status_code == 401


async def test_login_rate_limit_kicks_in(client, admin_user) -> None:
    """Vượt quá ngưỡng cho phép thì server trả 429 dù credentials đúng.

    Default settings là 60/h. Test này gọi 60 lần sai (đã hết quota), lần
    thứ 61 với credentials đúng vẫn phải 429.
    """
    for _ in range(60):
        await _login(client, admin_user.email, "wrong")
    r = await _login(client, admin_user.email, "correct-horse-12")
    assert r.status_code == 429

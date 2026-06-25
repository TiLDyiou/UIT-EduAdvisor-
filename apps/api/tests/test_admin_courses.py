from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import select

from app.api.v1.admin.router import router as admin_router
from app.core.security.passwords import hash_password
from app.db.models.academic import Course
from app.db.models.core_security import AdminUser, AuditLog
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


async def _admin_login_and_csrf(client: httpx.AsyncClient, admin_user: AdminUser) -> str:
    login = await client.post(
        "/api/v1/admin/auth/login",
        json={"email": admin_user.email, "password": "correct-horse-12"},
    )
    assert login.status_code == 204
    me = await client.get("/api/v1/admin/me")
    assert me.status_code == 200
    return me.json()["csrf_token"]


async def test_create_course_normalizes_code_and_writes_audit(
    client, admin_user, db_session
) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    r = await client.post(
        "/api/v1/admin/courses",
        json={
            "code": "  it001 ",
            "name": "Nhap mon CNTT",
            "credits": 3,
            "kind": "core",
            "difficulty": "medium",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["code"] == "IT001"
    assert body["admin_locked"] is True

    res = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "admin.course.created")
    )
    logs = list(res.scalars().all())
    assert len(logs) == 1
    assert logs[0].actor_id == admin_user.id


async def test_list_courses_with_search_filter_and_pagination(
    client, admin_user, db_session
) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    payloads = [
        {"code": "IT001", "name": "Nhap mon", "credits": 3, "kind": "core", "difficulty": "easy"},
        {
            "code": "IT002",
            "name": "Cau truc du lieu",
            "credits": 4,
            "kind": "core",
            "difficulty": "hard",
        },
        {
            "code": "IT003",
            "name": "Do an",
            "credits": 2,
            "kind": "elective",
            "difficulty": "medium",
        },
    ]
    for payload in payloads:
        r = await client.post(
            "/api/v1/admin/courses",
            json=payload,
            headers={"X-CSRF-Token": csrf},
        )
        assert r.status_code == 201

    r = await client.get(
        "/api/v1/admin/courses", params={"search": "cau", "limit": 10, "offset": 0}
    )
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["code"] == "IT002"

    r2 = await client.get(
        "/api/v1/admin/courses",
        params={"kind": "core", "limit": 1, "offset": 1},
    )
    assert r2.status_code == 200
    assert r2.json()["total"] == 2
    assert len(r2.json()["items"]) == 1


async def test_set_prerequisites_rejects_cycle(client, admin_user) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    c1 = await client.post(
        "/api/v1/admin/courses",
        json={"code": "IT010", "name": "A", "credits": 3, "kind": "core", "difficulty": "easy"},
        headers={"X-CSRF-Token": csrf},
    )
    c2 = await client.post(
        "/api/v1/admin/courses",
        json={"code": "IT011", "name": "B", "credits": 3, "kind": "core", "difficulty": "easy"},
        headers={"X-CSRF-Token": csrf},
    )
    course_a = c1.json()
    course_b = c2.json()

    set_a = await client.put(
        f"/api/v1/admin/courses/{course_a['id']}/prerequisites",
        json={"prerequisites": [{"prerequisite_id": course_b["id"], "kind": "prerequisite"}]},
        headers={"X-CSRF-Token": csrf},
    )
    assert set_a.status_code == 200

    set_b = await client.put(
        f"/api/v1/admin/courses/{course_b['id']}/prerequisites",
        json={"prerequisites": [{"prerequisite_id": course_a["id"], "kind": "prerequisite"}]},
        headers={"X-CSRF-Token": csrf},
    )
    assert set_b.status_code == 422
    assert set_b.json()["detail"]["error"] == "prerequisite_cycle_detected"


async def test_delete_course_rejected_when_referenced_as_prerequisite(client, admin_user) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    c1 = await client.post(
        "/api/v1/admin/courses",
        json={
            "code": "IT020",
            "name": "Target",
            "credits": 3,
            "kind": "core",
            "difficulty": "easy",
        },
        headers={"X-CSRF-Token": csrf},
    )
    c2 = await client.post(
        "/api/v1/admin/courses",
        json={"code": "IT021", "name": "Owner", "credits": 3, "kind": "core", "difficulty": "easy"},
        headers={"X-CSRF-Token": csrf},
    )
    target = c1.json()
    owner = c2.json()

    await client.put(
        f"/api/v1/admin/courses/{owner['id']}/prerequisites",
        json={"prerequisites": [{"prerequisite_id": target["id"], "kind": "prerequisite"}]},
        headers={"X-CSRF-Token": csrf},
    )
    delete_resp = await client.delete(
        f"/api/v1/admin/courses/{target['id']}",
        headers={"X-CSRF-Token": csrf},
    )
    assert delete_resp.status_code == 409
    assert delete_resp.json()["detail"]["error"] == "course_in_use"


async def test_update_course_marks_admin_locked(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    created = await client.post(
        "/api/v1/admin/courses",
        json={
            "code": "IT030",
            "name": "Mon cu",
            "credits": 3,
            "kind": "core",
            "difficulty": "easy",
        },
        headers={"X-CSRF-Token": csrf},
    )
    course_id = created.json()["id"]
    patched = await client.patch(
        f"/api/v1/admin/courses/{course_id}",
        json={"name": "Mon moi", "credits": 4},
        headers={"X-CSRF-Token": csrf},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Mon moi"
    assert patched.json()["credits"] == 4

    res = await db_session.execute(select(Course).where(Course.id == course_id))
    row = res.scalar_one()
    assert row.admin_locked is True
    assert row.admin_updated_at is not None

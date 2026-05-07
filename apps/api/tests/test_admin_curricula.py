from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import select

from app.api.v1.admin.router import router as admin_router
from app.core.security.passwords import hash_password
from app.db.models.academic import Curriculum, CurriculumTerm, ElectiveGroup
from app.db.models.core_security import AdminUser, AuditLog, Major
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


async def _create_major(db_session, code: str = "SE", name: str = "Software Engineering") -> Major:
    row = Major(code=code, name=name)
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return row


async def _create_course(client: httpx.AsyncClient, csrf: str, code: str, name: str) -> int:
    r = await client.post(
        "/api/v1/admin/courses",
        json={"code": code, "name": name, "credits": 3, "kind": "core", "difficulty": "medium"},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 201
    return r.json()["id"]


async def test_create_and_list_curricula(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    major = await _create_major(db_session)

    created = await client.post(
        "/api/v1/admin/curricula",
        json={"major_id": major.id, "name": "KTPM 2026", "effective_year": 2026, "total_credits": 140},
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 201
    assert created.json()["major_id"] == major.id

    listed = await client.get(
        "/api/v1/admin/curricula",
        params={"major_id": major.id, "effective_year": 2026, "limit": 10, "offset": 0},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["name"] == "KTPM 2026"


async def test_replace_curriculum_structure_transactionally(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    major = await _create_major(db_session, code="IS", name="Information Systems")
    c1 = await _create_course(client, csrf, "IT101", "Nhap mon 1")
    c2 = await _create_course(client, csrf, "IT102", "Nhap mon 2")
    c3 = await _create_course(client, csrf, "IT103", "Nhap mon 3")

    cur = await client.post(
        "/api/v1/admin/curricula",
        json={"major_id": major.id, "name": "IS 2026", "effective_year": 2026, "total_credits": 130},
        headers={"X-CSRF-Token": csrf},
    )
    curriculum_id = cur.json()["id"]

    structure = await client.put(
        f"/api/v1/admin/curricula/{curriculum_id}/structure",
        json={
            "terms": [
                {"term_number": 1, "courses": [{"course_id": c1, "is_required": True}]},
                {"term_number": 2, "courses": [{"course_id": c2, "is_required": False}]},
            ],
            "elective_groups": [
                {
                    "name": "Group A",
                    "rule_type": "min_courses",
                    "required_value": 1,
                    "course_ids": [c2],
                }
            ],
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert structure.status_code == 200
    assert len(structure.json()["terms"]) == 2
    assert len(structure.json()["elective_groups"]) == 1

    # phải reject vì course ngoài terms; không được ghi nửa vời
    bad = await client.put(
        f"/api/v1/admin/curricula/{curriculum_id}/structure",
        json={
            "terms": [{"term_number": 1, "courses": [{"course_id": c1, "is_required": True}]}],
            "elective_groups": [
                {
                    "name": "Bad",
                    "rule_type": "min_credits",
                    "required_value": 3,
                    "course_ids": [c3],
                }
            ],
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert bad.status_code == 422
    assert bad.json()["detail"]["error"] == "elective_group_course_outside_curriculum"

    detail = await client.get(f"/api/v1/admin/curricula/{curriculum_id}")
    assert detail.status_code == 200
    assert len(detail.json()["terms"]) == 2
    assert detail.json()["elective_groups"][0]["name"] == "Group A"


async def test_delete_curriculum_writes_audit(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    major = await _create_major(db_session, code="AI", name="Artificial Intelligence")
    created = await client.post(
        "/api/v1/admin/curricula",
        json={"major_id": major.id, "name": "AI 2026", "effective_year": 2026, "total_credits": 128},
        headers={"X-CSRF-Token": csrf},
    )
    curriculum_id = created.json()["id"]

    deleted = await client.delete(
        f"/api/v1/admin/curricula/{curriculum_id}",
        headers={"X-CSRF-Token": csrf},
    )
    assert deleted.status_code == 204

    res = await db_session.execute(select(Curriculum).where(Curriculum.id == curriculum_id))
    assert res.scalar_one_or_none() is None

    logs = await db_session.execute(select(AuditLog).where(AuditLog.action == "admin.curriculum.deleted"))
    assert len(list(logs.scalars().all())) == 1


async def test_replace_structure_writes_audit_and_rows(client, admin_user, db_session) -> None:
    csrf = await _admin_login_and_csrf(client, admin_user)
    major = await _create_major(db_session, code="CS", name="Computer Science")
    c1 = await _create_course(client, csrf, "IT201", "CTDL")
    c2 = await _create_course(client, csrf, "IT202", "GT2")

    created = await client.post(
        "/api/v1/admin/curricula",
        json={"major_id": major.id, "name": "CS 2026", "effective_year": 2026, "total_credits": 140},
        headers={"X-CSRF-Token": csrf},
    )
    curriculum_id = created.json()["id"]
    replaced = await client.put(
        f"/api/v1/admin/curricula/{curriculum_id}/structure",
        json={
            "terms": [
                {"term_number": 1, "courses": [{"course_id": c1, "is_required": True}]},
                {"term_number": 2, "courses": [{"course_id": c2, "is_required": False}]},
            ],
            "elective_groups": [],
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert replaced.status_code == 200

    term_rows = await db_session.execute(
        select(CurriculumTerm).where(CurriculumTerm.curriculum_id == curriculum_id)
    )
    assert len(list(term_rows.scalars().all())) == 2

    group_rows = await db_session.execute(
        select(ElectiveGroup).where(ElectiveGroup.curriculum_id == curriculum_id)
    )
    assert len(list(group_rows.scalars().all())) == 0

    logs = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "admin.curriculum.structure_replaced")
    )
    assert len(list(logs.scalars().all())) == 1

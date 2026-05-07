"""Opaque sessions in Redis + httpOnly cookie.

Student và admin dùng prefix Redis khác nhau và cookie name khác nhau để
tránh trộn scope (cookie student không thể impersonate admin và ngược lại).
"""

from __future__ import annotations

import json
import secrets
import uuid
from dataclasses import dataclass
from typing import Any

from redis.asyncio import Redis


@dataclass(frozen=True)
class StudentSession:
    student_id: uuid.UUID
    csrf_token: str


def session_key(token: str) -> str:
    return f"session:student:{token}"


async def create_student_session(
    redis: Redis,
    *,
    student_id: uuid.UUID,
    ttl_seconds: int,
) -> tuple[str, str]:
    """Return (opaque_session_token, csrf_token)."""
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    payload: dict[str, Any] = {"student_id": str(student_id), "csrf": csrf}
    await redis.set(session_key(token), json.dumps(payload), ex=ttl_seconds)
    return token, csrf


async def get_student_session(redis: Redis, token: str | None) -> StudentSession | None:
    if not token:
        return None
    raw = await redis.get(session_key(token))
    if not raw:
        return None
    data = json.loads(raw)
    return StudentSession(student_id=uuid.UUID(data["student_id"]), csrf_token=str(data["csrf"]))


async def revoke_student_session(redis: Redis, token: str | None) -> None:
    if not token:
        return
    await redis.delete(session_key(token))


async def rotate_csrf_token(redis: Redis, token: str, ttl_fallback: int) -> str:
    """Return new CSRF token; preserves student_id and refreshes TTL if Redis returns a positive TTL."""
    raw = await redis.get(session_key(token))
    if not raw:
        raise KeyError("session_not_found")
    data = json.loads(raw)
    new_csrf = secrets.token_urlsafe(32)
    data["csrf"] = new_csrf
    ttl = await redis.ttl(session_key(token))
    ex = ttl if ttl and ttl > 0 else ttl_fallback
    await redis.set(session_key(token), json.dumps(data), ex=ex)
    return new_csrf


# ---------------------------------------------------------------------------
# Admin sessions
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AdminSession:
    admin_id: uuid.UUID
    csrf_token: str


def admin_session_key(token: str) -> str:
    return f"session:admin:{token}"


async def create_admin_session(
    redis: Redis,
    *,
    admin_id: uuid.UUID,
    ttl_seconds: int,
) -> tuple[str, str]:
    """Return (opaque_session_token, csrf_token)."""
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    payload: dict[str, Any] = {"admin_id": str(admin_id), "csrf": csrf}
    await redis.set(admin_session_key(token), json.dumps(payload), ex=ttl_seconds)
    return token, csrf


async def get_admin_session(redis: Redis, token: str | None) -> AdminSession | None:
    if not token:
        return None
    raw = await redis.get(admin_session_key(token))
    if not raw:
        return None
    data = json.loads(raw)
    return AdminSession(admin_id=uuid.UUID(data["admin_id"]), csrf_token=str(data["csrf"]))


async def revoke_admin_session(redis: Redis, token: str | None) -> None:
    if not token:
        return
    await redis.delete(admin_session_key(token))

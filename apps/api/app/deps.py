"""FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.sessions import (
    AdminSession,
    StudentSession,
    get_admin_session,
    get_student_session,
)
from app.db.models.core_security import AdminUser, Student
from app.db.session import get_sessionmaker


async def get_db() -> AsyncSession:
    maker = get_sessionmaker()
    async with maker() as session:
        yield session


def get_redis(request: Request) -> Redis:
    return request.app.state.redis


def get_vault_transit(request: Request):
    return request.app.state.vault_transit


def get_settings_dep() -> Settings:
    return get_settings()


async def get_current_student_session(
    request: Request,
    redis: Annotated[Redis, Depends(get_redis)],
) -> StudentSession:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    sess = await get_student_session(redis, token)
    if sess is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="session_required")
    return sess


async def get_current_student(
    db: Annotated[AsyncSession, Depends(get_db)],
    sess: Annotated[StudentSession, Depends(get_current_student_session)],
) -> Student:
    res = await db.execute(select(Student).where(Student.id == sess.student_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="student_not_found")
    return row


def require_csrf(
    request: Request,
    sess: Annotated[StudentSession, Depends(get_current_student_session)],
) -> None:
    token = request.headers.get("x-csrf-token")
    if not token or token != sess.csrf_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="csrf_failed")


async def get_current_admin_session(
    request: Request,
    redis: Annotated[Redis, Depends(get_redis)],
) -> AdminSession:
    settings = get_settings()
    token = request.cookies.get(settings.admin_session_cookie_name)
    sess = await get_admin_session(redis, token)
    if sess is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="admin_session_required"
        )
    return sess


async def get_current_admin(
    db: Annotated[AsyncSession, Depends(get_db)],
    sess: Annotated[AdminSession, Depends(get_current_admin_session)],
) -> AdminUser:
    res = await db.execute(select(AdminUser).where(AdminUser.id == sess.admin_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="admin_not_found")
    return row


def require_admin_csrf(
    request: Request,
    sess: Annotated[AdminSession, Depends(get_current_admin_session)],
) -> None:
    token = request.headers.get("x-csrf-token")
    if not token or token != sess.csrf_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="csrf_failed")


def mask_student_code(plain: str) -> str:
    if len(plain) <= 2:
        return "**"
    return f"**{plain[-4:]}"


def enrollment_year_from_code(student_code: str) -> int:
    """Heuristic for UIT MSSV: leading two digits often mean admission year mod century."""
    if len(student_code) >= 2 and student_code[:2].isdigit():
        yy = int(student_code[:2])
        return 2000 + yy
    return 2024

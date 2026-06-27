"""Admin login/logout/me. Tách hoàn toàn session/cookie với student."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.rate_limit import RateLimiter
from app.core.security.audit import record_audit
from app.core.security.passwords import verify_password
from app.core.sessions import (
    AdminSession,
    create_admin_session,
    revoke_admin_session,
)
from app.db.models.core_security import AdminUser
from app.deps import (
    get_current_admin,
    get_current_admin_session,
    get_db,
    get_redis,
    get_settings_dep,
    require_admin_csrf,
)
from app.schemas.admin.auth import AdminLoginRequest, AdminMeResponse

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/login")
async def admin_login(
    request: Request,
    body: AdminLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> Response:
    ip = _client_ip(request)
    rl = RateLimiter(redis)
    allowed, _, reset_in = await rl.check(
        f"admin:login:ip:{ip}", settings.admin_login_rate_limit_per_hour, 3600
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate_limited", "retry_in_seconds": reset_in},
        )

    email = body.email.strip().lower()
    res = await db.execute(select(AdminUser).where(AdminUser.email == email).limit(1))
    admin = res.scalar_one_or_none()

    # Trả cùng error cho email-không-tồn-tại và sai password để không leak
    # thông tin tài khoản nào hợp lệ.
    if admin is None or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

    sess_token, _csrf = await create_admin_session(
        redis, admin_id=admin.id, ttl_seconds=settings.admin_session_ttl_seconds
    )

    admin.last_login_at = datetime.now(UTC)
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.session.login",
        target_type="admin_user",
        target_id=str(admin.id),
        payload={"user_agent": request.headers.get("user-agent")},
        ip_address=ip,
    )
    await db.commit()

    resp = Response(status_code=status.HTTP_204_NO_CONTENT)
    resp.set_cookie(
        key=settings.admin_session_cookie_name,
        value=sess_token,
        max_age=settings.admin_session_ttl_seconds,
        httponly=True,
        secure=settings.admin_session_cookie_secure,
        samesite="none",
        path="/",
    )
    return resp


@router.post("/logout", dependencies=[Depends(require_admin_csrf)])
async def admin_logout(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> Response:
    token = request.cookies.get(settings.admin_session_cookie_name)
    await revoke_admin_session(redis, token)
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.session.logout",
        target_type="admin_user",
        target_id=str(admin.id),
        ip_address=_client_ip(request),
    )
    await db.commit()
    res = Response(status_code=status.HTTP_204_NO_CONTENT)
    res.delete_cookie(
        settings.admin_session_cookie_name,
        path="/",
        secure=settings.admin_session_cookie_secure,
        samesite="none",
    )
    return res


me_router = APIRouter(prefix="/admin", tags=["admin"])


@me_router.get("/me", response_model=AdminMeResponse)
async def admin_me(
    admin: Annotated[AdminUser, Depends(get_current_admin)],
    sess: Annotated[AdminSession, Depends(get_current_admin_session)],
) -> AdminMeResponse:
    return AdminMeResponse(id=admin.id, email=admin.email, csrf_token=sess.csrf_token)

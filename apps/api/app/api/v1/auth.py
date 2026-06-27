from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from redis.asyncio import Redis

from app.core.config import get_settings
from app.core.sessions import revoke_student_session
from app.deps import get_redis

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    redis: Annotated[Redis, Depends(get_redis)],
) -> Response:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    await revoke_student_session(redis, token)
    res = Response(status_code=status.HTTP_204_NO_CONTENT)
    res.delete_cookie(settings.session_cookie_name, path="/")
    return res

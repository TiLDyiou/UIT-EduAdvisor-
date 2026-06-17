"""On-demand DAA re-sync: student already has saved credentials."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.rate_limit import RateLimiter
from app.core.security.vault_transit import VaultTransit
from app.db.models.core_security import Student, StudentCredential, SyncJob
from app.deps import (
    get_current_student,
    get_current_student_session,
    get_db,
    get_redis,
    get_settings_dep,
    get_vault_transit,
    require_csrf,
)
from app.schemas.m2 import DaaCaptchaResponse
from app.schemas.resync import ResyncDaaRequest, ResyncDaaResponse
from app.services.daa.client import (
    daa_login_with_state,
    delete_captcha_state,
    fetch_captcha_bundle,
)
from app.services.daa.errors import DaaAuthError
from app.services.sync.onboarding_sync import run_onboarding_sync

router = APIRouter(prefix="/resync", tags=["resync"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.get("/daa-captcha", response_model=DaaCaptchaResponse)
async def resync_daa_captcha(
    request: Request,
    redis: Annotated[Redis, Depends(get_redis)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    _sess=Depends(get_current_student_session),
) -> DaaCaptchaResponse:
    """Fetch a fresh DAA captcha for re-sync (requires active session)."""
    rl = RateLimiter(redis)
    ip = _client_ip(request)
    allowed, _, reset_in = await rl.check(
        f"daa:captcha:ip:{ip}", settings.daa_captcha_rate_limit_per_hour, 3600
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate_limited", "retry_in_seconds": reset_in},
        )
    bundle = await fetch_captcha_bundle(redis, settings)
    return DaaCaptchaResponse(
        captcha_state_id=bundle.captcha_state_id,
        question=bundle.question,
        image_base64=bundle.image_base64,
    )


@router.post("/daa")
async def resync_daa(
    request: Request,
    body: ResyncDaaRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
    vault: Annotated[VaultTransit, Depends(get_vault_transit)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
) -> JSONResponse:
    """Re-sync DAA data using saved credential. Only captcha answer needed."""

    # Rate limit
    rl = RateLimiter(redis)
    ip = _client_ip(request)
    allowed, _, reset_in = await rl.check(
        f"daa:login:ip:{ip}", settings.daa_login_rate_limit_per_hour, 3600
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate_limited", "retry_in_seconds": reset_in},
        )

    # Load saved credential
    res = await db.execute(
        select(StudentCredential)
        .where(StudentCredential.student_id == student.id)
        .limit(1)
    )
    cred = res.scalar_one_or_none()
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="no_saved_credential",
        )

    # Decrypt student code and password
    student_code = (
        await vault.decrypt_deterministic(student.student_code_ciphertext)
    ).decode("utf-8")
    password_plain = (await vault.decrypt(cred.password_ciphertext)).decode("utf-8")

    # Login DAA with captcha
    daa_client = None
    try:
        daa_client = await daa_login_with_state(
            redis,
            settings,
            state_id=body.captcha_state_id,
            student_code=student_code,
            password=password_plain,
            captcha_answer=body.captcha_answer.strip(),
        )
    except DaaAuthError as exc:
        await delete_captcha_state(redis, body.captcha_state_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except Exception:
        if daa_client is not None:
            await daa_client.aclose()
        await delete_captcha_state(redis, body.captcha_state_id)
        raise

    await delete_captcha_state(redis, body.captcha_state_id)

    # Create sync job
    job = SyncJob(
        student_id=student.id,
        kind="resync_daa",
        status="running",
        started_at=datetime.now(UTC),
        current_stage="daa_profile",
        progress_percent=5,
    )
    db.add(job)
    await db.flush()
    await db.commit()

    # Launch background sync (reuses the same orchestrator)
    asyncio.create_task(
        run_onboarding_sync(
            job_id=job.id,
            student_id=student.id,
            student_code=student_code,
            password_plain=password_plain,
            daa_client=daa_client,
            settings=settings,
            redis=redis,
            vault_transit=vault,
        )
    )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=ResyncDaaResponse(job_id=job.id).model_dump(mode="json"),
    )

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.legal import POLICY_VERSION, TOS_VERSION
from app.core.rate_limit import RateLimiter
from app.core.security.consent import consent_guard_ok, record_consent
from app.core.security.vault_transit import VaultTransit
from app.core.sessions import create_student_session
from app.db.models.core_security import Major, Student, StudentCredential, SyncJob
from app.deps import (
    enrollment_year_from_code,
    get_db,
    get_redis,
    get_settings_dep,
    get_vault_transit,
)
from app.schemas.m2 import DaaCaptchaResponse, OnboardingStartRequest, OnboardingStartResponse
from app.services.daa.client import daa_login_with_state, delete_captcha_state, fetch_captcha_bundle
from app.services.daa.errors import DaaAuthError
from app.services.sync.onboarding_sync import run_onboarding_sync

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.get("/daa-captcha", response_model=DaaCaptchaResponse)
async def daa_captcha(
    request: Request,
    redis: Annotated[Redis, Depends(get_redis)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> DaaCaptchaResponse:
    # rl = RateLimiter(redis)
    # ip = _client_ip(request)
    # allowed, _, reset_in = await rl.check(
    #     f"daa:captcha:ip:{ip}", settings.daa_captcha_rate_limit_per_hour, 3600
    # )
    # if not allowed:
    #     raise HTTPException(
    #         status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    #         detail={"error": "rate_limited", "retry_in_seconds": reset_in},
    #     )
    bundle = await fetch_captcha_bundle(redis, settings)
    return DaaCaptchaResponse(
        captcha_state_id=bundle.captcha_state_id,
        question=bundle.question,
        image_base64=bundle.image_base64,
    )


@router.post("/start")
async def onboarding_start(
    request: Request,
    body: OnboardingStartRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
    vault: Annotated[VaultTransit, Depends(get_vault_transit)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> JSONResponse:
    if not consent_guard_ok(
        privacy_accepted=body.privacy_accepted,
        tos_accepted=body.tos_accepted,
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="consent_required")

    mssv = body.student_code.strip()
    ip = _client_ip(request)

    daa_client = None
    try:
        daa_client = await daa_login_with_state(
            redis,
            settings,
            state_id=body.captcha_state_id,
            student_code=mssv,
            password=body.password,
            captcha_answer=body.captcha_answer.strip(),
        )
    except DaaAuthError as exc:
        # fails_key = f"daa:captcha:fails:{mssv}"
        # fails = int(await redis.incr(fails_key))
        # await redis.expire(fails_key, 3600)
        # if fails >= settings.captcha_fail_threshold:
        #     await redis.set(cooldown_key, "1", ex=settings.captcha_cooldown_seconds)
        await delete_captcha_state(redis, body.captcha_state_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception:
        if daa_client is not None:
            await daa_client.aclose()
        await delete_captcha_state(redis, body.captcha_state_id)
        raise

    await delete_captcha_state(redis, body.captcha_state_id)
    await redis.delete(f"daa:captcha:fails:{mssv}")

    try:
        code_ct = await vault.encrypt_deterministic(mssv.encode("utf-8"))
        res = await db.execute(
            select(Student).where(Student.student_code_ciphertext == code_ct).limit(1)
        )
        student = res.scalar_one_or_none()

        mj = await db.execute(select(Major).where(Major.code == "UNKNOWN").limit(1))
        major = mj.scalar_one_or_none()
        if major is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="missing_unknown_major"
            )

        if student is None:
            placeholder = await vault.encrypt("Sinh viên (chưa đồng bộ tên)".encode())
            student = Student(
                student_code_ciphertext=code_ct,
                full_name_ciphertext=placeholder,
                major_id=major.id,
                enrollment_year=enrollment_year_from_code(mssv),
            )
            db.add(student)
            await db.flush()

        consent_row = await record_consent(
            db,
            student_id=student.id,
            privacy_policy_version=POLICY_VERSION,
            tos_version=TOS_VERSION,
            consented_at=datetime.now(UTC),
            ip_address=ip,
            user_agent=request.headers.get("user-agent"),
        )
        await db.flush()

        await db.execute(
            delete(StudentCredential).where(StudentCredential.student_id == student.id)
        )
        pw_ct = await vault.encrypt(body.password.encode("utf-8"))
        cred = StudentCredential(
            student_id=student.id,
            password_ciphertext=pw_ct,
            consent_id=consent_row.id,
        )
        db.add(cred)

        job = SyncJob(
            student_id=student.id,
            kind="onboarding",
            status="running",
            started_at=datetime.now(UTC),
            current_stage="daa_profile",
            progress_percent=5,
        )
        db.add(job)
        await db.flush()

        await db.commit()

        sess_token, _csrf = await create_student_session(
            redis, student_id=student.id, ttl_seconds=settings.student_session_ttl_seconds
        )

        asyncio.create_task(
            run_onboarding_sync(
                job_id=job.id,
                student_id=student.id,
                student_code=mssv,
                password_plain=body.password,
                daa_client=daa_client,
                settings=settings,
                redis=redis,
                vault_transit=vault,
            )
        )

        resp = JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content=OnboardingStartResponse(job_id=job.id, student_id=student.id).model_dump(
                mode="json"
            ),
        )
        resp.set_cookie(
            key=settings.session_cookie_name,
            value=sess_token,
            max_age=settings.student_session_ttl_seconds,
            httponly=True,
            secure=settings.session_cookie_secure,
            samesite="lax",
            path="/",
        )
        return resp
    except HTTPException:
        await db.rollback()
        await daa_client.aclose()
        raise
    except Exception:
        await db.rollback()
        await daa_client.aclose()
        raise

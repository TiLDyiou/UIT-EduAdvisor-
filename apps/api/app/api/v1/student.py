from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security.audit import record_audit
from app.core.security.vault_transit import VaultTransit
from app.core.sessions import StudentSession, revoke_student_session
from app.db.models.core_security import Student, StudentCredential
from app.deps import (
    get_current_student,
    get_current_student_session,
    get_db,
    get_redis,
    get_vault_transit,
    mask_student_code,
    require_csrf,
)
from app.schemas.m2 import MeResponse

router = APIRouter(tags=["student"])


@router.get("/me", response_model=MeResponse)
async def me(
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    sess: Annotated[StudentSession, Depends(get_current_student_session)],
    vault: Annotated[VaultTransit, Depends(get_vault_transit)],
) -> MeResponse:
    plain = (await vault.decrypt_deterministic(student.student_code_ciphertext)).decode("utf-8")
    r = await db.execute(
        select(StudentCredential).where(StudentCredential.student_id == student.id).limit(1)
    )
    has_cred = r.scalar_one_or_none() is not None
    return MeResponse(
        student_id=student.id,
        student_code_masked=mask_student_code(plain),
        has_credential=has_cred,
        csrf_token=sess.csrf_token,
    )


@router.delete("/me/credential", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
) -> Response:
    ip = request.client.host if request.client else None
    await db.execute(delete(StudentCredential).where(StudentCredential.student_id == student.id))
    await record_audit(
        db,
        actor_type="student",
        actor_id=student.id,
        action="credential_deleted",
        target_type="student",
        target_id=str(student.id),
        payload=None,
        ip_address=ip,
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me/data", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_data(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    redis: Annotated[Redis, Depends(get_redis)],
    _: Annotated[None, Depends(require_csrf)],
) -> Response:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    ip = request.client.host if request.client else None
    sid = student.id
    await record_audit(
        db,
        actor_type="student",
        actor_id=sid,
        action="student_data_deleted",
        target_type="student",
        target_id=str(sid),
        payload=None,
        ip_address=ip,
    )
    await db.execute(delete(Student).where(Student.id == sid))
    await db.commit()
    await revoke_student_session(redis, token)
    res = Response(status_code=status.HTTP_204_NO_CONTENT)
    res.delete_cookie(settings.session_cookie_name, path="/")
    return res

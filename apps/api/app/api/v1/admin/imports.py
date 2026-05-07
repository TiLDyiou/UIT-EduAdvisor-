from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security.audit import record_audit
from app.db.models.core_security import AdminJob, AdminUser
from app.deps import get_current_admin, get_db, get_settings_dep, require_admin_csrf
from app.schemas.admin.imports import AdminImportApplyResponse, AdminImportUploadResponse
from app.schemas.admin.jobs import AdminJobResponse
from app.services.admin_jobs import (
    JOB_STATUS_QUEUED,
    JOB_STATUS_SUCCEEDED,
    create_admin_job,
    to_job_response_dict,
)
from app.services.excel_import import validate_xlsx_readable

router = APIRouter(prefix="/admin/imports", tags=["admin-imports"])

IMPORT_KIND_COURSE_OFFERING = "course_offering_import"
IMPORT_KIND_EXAM_SCHEDULE = "exam_schedule_import"
ALLOWED_IMPORT_EXT = {".xlsx"}


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _validate_import_file(file: UploadFile, size: int, settings: Settings) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMPORT_EXT:
        raise HTTPException(status_code=422, detail={"error": "unsupported_extension"})
    if size == 0:
        raise HTTPException(status_code=422, detail={"error": "empty_file"})
    if size > settings.admin_upload_max_file_size_bytes:
        raise HTTPException(status_code=413, detail={"error": "file_too_large"})
    return ext


async def _store_uploaded_file(settings: Settings, suffix: str, payload: bytes) -> str:
    root = Path(settings.admin_private_storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    filename = f"import_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(8)}{suffix}"
    full_path = root / filename
    full_path.write_bytes(payload)
    return str(full_path)


async def _enqueue_import_job(
    *,
    kind: str,
    request: Request,
    db: AsyncSession,
    admin: AdminUser,
    settings: Settings,
    file: UploadFile,
) -> AdminImportUploadResponse:
    payload = await file.read()
    ext = _validate_import_file(file, len(payload), settings)
    path = await _store_uploaded_file(settings, ext, payload)
    try:
        validate_xlsx_readable(path)
    except Exception as exc:
        raise HTTPException(status_code=422, detail={"error": "invalid_xlsx_file"}) from exc
    job = await create_admin_job(
        db,
        kind=kind,
        created_by=admin.id,
        input_file_path=path,
        result_summary={
            "filename": file.filename,
            "preview": {"valid_rows": 0, "invalid_rows": 0, "errors": ["pending_worker_preview"]},
        },
    )
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.import.uploaded",
        target_type="admin_job",
        target_id=str(job.id),
        payload={"kind": kind, "filename": file.filename},
        ip_address=_client_ip(request),
    )
    await db.commit()
    job_dict = to_job_response_dict(job)
    return AdminImportUploadResponse(job_id=job_dict["id"], kind=job_dict["kind"], status=job_dict["status"])


@router.post(
    "/course-offerings",
    response_model=AdminImportUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_admin_csrf)],
)
async def upload_course_offerings_import(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    file: UploadFile = File(...),
) -> AdminImportUploadResponse:
    return await _enqueue_import_job(
        kind=IMPORT_KIND_COURSE_OFFERING,
        request=request,
        db=db,
        admin=admin,
        settings=settings,
        file=file,
    )


@router.post(
    "/exam-schedules",
    response_model=AdminImportUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_admin_csrf)],
)
async def upload_exam_schedules_import(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    file: UploadFile = File(...),
) -> AdminImportUploadResponse:
    return await _enqueue_import_job(
        kind=IMPORT_KIND_EXAM_SCHEDULE,
        request=request,
        db=db,
        admin=admin,
        settings=settings,
        file=file,
    )


@router.get("/{job_id}", response_model=AdminJobResponse)
async def get_import_status(
    job_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminJobResponse:
    res = await db.execute(select(AdminJob).where(AdminJob.id == job_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="job_not_found")
    return AdminJobResponse.model_validate(to_job_response_dict(row))


@router.post(
    "/{job_id}/apply",
    response_model=AdminImportApplyResponse,
    dependencies=[Depends(require_admin_csrf)],
)
async def apply_import_job(
    job_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminImportApplyResponse:
    res = await db.execute(select(AdminJob).where(AdminJob.id == job_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="job_not_found")
    if row.kind not in {IMPORT_KIND_COURSE_OFFERING, IMPORT_KIND_EXAM_SCHEDULE}:
        raise HTTPException(status_code=422, detail={"error": "not_import_job"})
    if row.status != JOB_STATUS_SUCCEEDED or row.current_stage != "preview_completed":
        raise HTTPException(status_code=409, detail={"error": "preview_not_ready"})
    row.status = JOB_STATUS_QUEUED
    row.current_stage = "apply_queued"
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.import.apply_requested",
        target_type="admin_job",
        target_id=str(row.id),
        payload={"kind": row.kind},
        ip_address=_client_ip(request),
    )
    await db.commit()
    return AdminImportApplyResponse(job_id=row.id, status=row.status)

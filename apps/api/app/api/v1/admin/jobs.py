from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.core_security import AdminJob, AdminUser
from app.deps import get_current_admin, get_db
from app.schemas.admin.jobs import AdminJobResponse
from app.services.admin_jobs import to_job_response_dict

router = APIRouter(prefix="/admin/jobs", tags=["admin-jobs"])


@router.get("", response_model=list[AdminJobResponse])
async def list_admin_jobs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
    kind: str | None = Query(default=None, max_length=32),
    status: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[AdminJobResponse]:
    query = select(AdminJob)
    if kind:
        query = query.where(AdminJob.kind == kind.strip())
    if status:
        query = query.where(AdminJob.status == status.strip())
    rows = await db.execute(query.order_by(AdminJob.created_at.desc()).limit(limit).offset(offset))
    return [AdminJobResponse.model_validate(to_job_response_dict(row)) for row in rows.scalars().all()]


@router.get("/{job_id}", response_model=AdminJobResponse)
async def get_admin_job(
    job_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminJobResponse:
    res = await db.execute(select(AdminJob).where(AdminJob.id == job_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="job_not_found")
    return AdminJobResponse.model_validate(to_job_response_dict(row))

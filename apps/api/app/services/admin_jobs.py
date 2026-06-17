from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.core_security import AdminJob

JOB_STATUS_QUEUED = "queued"
JOB_STATUS_RUNNING = "running"
JOB_STATUS_SUCCEEDED = "succeeded"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_CANCELLED = "cancelled"


def to_job_response_dict(row: AdminJob) -> dict[str, Any]:
    return {
        "id": row.id,
        "kind": row.kind,
        "status": row.status,
        "created_by": row.created_by,
        "current_stage": row.current_stage,
        "progress_percent": row.progress_percent,
        "error_message": row.error_message,
        "result_summary": row.result_summary,
        "input_file_path": row.input_file_path,
        "created_at": row.created_at,
        "started_at": row.started_at,
        "finished_at": row.finished_at,
    }


async def create_admin_job(
    db: AsyncSession,
    *,
    kind: str,
    created_by: uuid.UUID,
    input_file_path: str | None = None,
    result_summary: dict[str, Any] | None = None,
) -> AdminJob:
    row = AdminJob(
        kind=kind,
        status=JOB_STATUS_QUEUED,
        created_by=created_by,
        current_stage="queued",
        progress_percent=0,
        input_file_path=input_file_path,
        result_summary=result_summary,
    )
    db.add(row)
    await db.flush()
    return row


async def claim_next_job(db: AsyncSession, *, kinds: set[str]) -> AdminJob | None:
    res = await db.execute(
        select(AdminJob)
        .where(AdminJob.status == JOB_STATUS_QUEUED, AdminJob.kind.in_(kinds))
        .order_by(AdminJob.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    row = res.scalar_one_or_none()
    if row is None:
        return None
    row.status = JOB_STATUS_RUNNING
    row.current_stage = "started"
    row.progress_percent = 1
    row.started_at = datetime.now(UTC)
    row.error_message = None
    return row

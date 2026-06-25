from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.core_security import AdminUser, AuditLog
from app.deps import get_current_admin, get_db
from app.schemas.admin.audit import AdminAuditLogItem, AdminAuditLogListResponse

router = APIRouter(prefix="/admin/audit-logs", tags=["admin-audit"])


@router.get("", response_model=AdminAuditLogListResponse)
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
    actor_id: uuid.UUID | None = Query(default=None),
    action: str | None = Query(default=None, max_length=128),
    target_type: str | None = Query(default=None, max_length=128),
    from_ts: datetime | None = Query(default=None),
    to_ts: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminAuditLogListResponse:
    query = select(AuditLog)
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
    if action:
        query = query.where(AuditLog.action == action.strip())
    if target_type:
        query = query.where(AuditLog.target_type == target_type.strip())
    if from_ts:
        query = query.where(AuditLog.created_at >= from_ts)
    if to_ts:
        query = query.where(AuditLog.created_at <= to_ts)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).offset(offset)
    )
    items = [
        AdminAuditLogItem(
            id=row.id,
            actor_type=row.actor_type,
            actor_id=row.actor_id,
            action=row.action,
            target_type=row.target_type,
            target_id=row.target_id,
            payload=row.payload,
            ip_address=row.ip_address,
            created_at=row.created_at,
        )
        for row in rows.scalars().all()
    ]
    return AdminAuditLogListResponse(items=items, total=total or 0, limit=limit, offset=offset)

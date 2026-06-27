from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security.audit import record_audit
from app.db.models.academic import TooltipTerm
from app.db.models.core_security import AdminUser
from app.db.models.rag_chat import PolicyDocument
from app.deps import get_current_admin, get_db, require_admin_csrf
from app.schemas.admin.tooltips import (
    AdminTooltipCreateRequest,
    AdminTooltipListResponse,
    AdminTooltipResponse,
    AdminTooltipUpdateRequest,
    PublicTooltipResponse,
    normalize_keyword,
)

router = APIRouter(prefix="/admin/tooltips", tags=["admin-tooltips"])
public_router = APIRouter(tags=["tooltips"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def _get_tooltip_or_404(db: AsyncSession, tooltip_id: int) -> TooltipTerm:
    res = await db.execute(select(TooltipTerm).where(TooltipTerm.id == tooltip_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="tooltip_not_found")
    return row


@router.get("", response_model=AdminTooltipListResponse)
async def list_tooltips(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
    search: str | None = Query(default=None, max_length=128),
    active: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminTooltipListResponse:
    query = select(TooltipTerm)
    if search:
        token = f"%{search.strip()}%"
        query = query.where(
            (TooltipTerm.keyword.ilike(token)) | (TooltipTerm.short_explanation.ilike(token))
        )
    if active is not None:
        query = query.where(TooltipTerm.is_active == active)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(query.order_by(TooltipTerm.keyword.asc()).limit(limit).offset(offset))
    items = [AdminTooltipResponse.model_validate(row) for row in rows.scalars().all()]
    return AdminTooltipListResponse(items=items, total=total or 0, limit=limit, offset=offset)


@router.post(
    "",
    response_model=AdminTooltipResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_csrf)],
)
async def create_tooltip(
    request: Request,
    body: AdminTooltipCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminTooltipResponse:
    if body.policy_document_id is not None:
        policy_exists = await db.scalar(
            select(func.count())
            .select_from(PolicyDocument)
            .where(PolicyDocument.id == body.policy_document_id)
        )
        if not policy_exists:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="policy_not_found"
            )

    row = TooltipTerm(
        keyword=body.keyword,
        normalized_keyword=normalize_keyword(body.keyword),
        short_explanation=body.short_explanation,
        policy_document_id=body.policy_document_id,
        policy_url=body.policy_url,
        is_active=body.is_active,
        created_by=admin.id,
        updated_by=admin.id,
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "duplicate_keyword"},
        ) from exc

    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.tooltip.created",
        target_type="tooltip_term",
        target_id=str(row.id),
        payload={"keyword": row.keyword},
        ip_address=_client_ip(request),
    )
    await db.commit()
    await db.refresh(row)
    return AdminTooltipResponse.model_validate(row)


@router.get("/{tooltip_id}", response_model=AdminTooltipResponse)
async def get_tooltip(
    tooltip_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminTooltipResponse:
    row = await _get_tooltip_or_404(db, tooltip_id)
    return AdminTooltipResponse.model_validate(row)


@router.patch(
    "/{tooltip_id}",
    response_model=AdminTooltipResponse,
    dependencies=[Depends(require_admin_csrf)],
)
async def update_tooltip(
    tooltip_id: int,
    request: Request,
    body: AdminTooltipUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminTooltipResponse:
    row = await _get_tooltip_or_404(db, tooltip_id)
    changes = body.model_dump(exclude_unset=True)
    if "policy_document_id" in changes and changes["policy_document_id"] is not None:
        policy_exists = await db.scalar(
            select(func.count())
            .select_from(PolicyDocument)
            .where(PolicyDocument.id == changes["policy_document_id"])
        )
        if not policy_exists:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="policy_not_found"
            )

    if changes:
        before = {
            "keyword": row.keyword,
            "short_explanation": row.short_explanation,
            "policy_document_id": row.policy_document_id,
            "policy_url": row.policy_url,
            "is_active": row.is_active,
        }
        for key, value in changes.items():
            setattr(row, key, value)
        if "keyword" in changes:
            row.normalized_keyword = normalize_keyword(changes["keyword"])
        row.updated_by = admin.id
        try:
            await db.flush()
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "duplicate_keyword"},
            ) from exc
        await record_audit(
            db,
            actor_type="admin",
            actor_id=admin.id,
            action="admin.tooltip.updated",
            target_type="tooltip_term",
            target_id=str(row.id),
            payload={
                "before": before,
                "after": {
                    "keyword": row.keyword,
                    "short_explanation": row.short_explanation,
                    "policy_document_id": row.policy_document_id,
                    "policy_url": row.policy_url,
                    "is_active": row.is_active,
                },
            },
            ip_address=_client_ip(request),
        )
        await db.commit()
        await db.refresh(row)
    return AdminTooltipResponse.model_validate(row)


@public_router.get("/tooltips", response_model=list[PublicTooltipResponse])
async def list_public_tooltips(
    db: Annotated[AsyncSession, Depends(get_db)],
    active: bool = Query(default=True),
) -> list[PublicTooltipResponse]:
    query = select(TooltipTerm).order_by(TooltipTerm.keyword.asc())
    if active:
        query = query.where(TooltipTerm.is_active.is_(True))
    rows = await db.execute(query)
    return [
        PublicTooltipResponse(
            keyword=row.keyword,
            short_explanation=row.short_explanation,
            policy_url=row.policy_url,
        )
        for row in rows.scalars().all()
    ]

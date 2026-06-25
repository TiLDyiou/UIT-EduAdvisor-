from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security.audit import record_audit
from app.db.models.academic import Course, CourseResource
from app.db.models.core_security import AdminUser
from app.deps import get_current_admin, get_db, require_admin_csrf
from app.schemas.admin.resources import (
    AdminResourceCreateRequest,
    AdminResourceListResponse,
    AdminResourceResponse,
    AdminResourceUpdateRequest,
)

router = APIRouter(prefix="/admin/resources", tags=["admin-resources"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _resource_query(
    course_id: int | None,
    term_code: str | None,
    resource_type: str | None,
    visible: bool | None,
) -> Select[tuple[CourseResource]]:
    query = select(CourseResource)
    if course_id:
        query = query.where(CourseResource.course_id == course_id)
    if term_code:
        query = query.where(CourseResource.term_code == term_code.strip())
    if resource_type:
        query = query.where(CourseResource.resource_type == resource_type.strip().lower())
    if visible is not None:
        query = query.where(CourseResource.is_visible == visible)
    return query


async def _get_resource_or_404(db: AsyncSession, resource_id: int) -> CourseResource:
    res = await db.execute(select(CourseResource).where(CourseResource.id == resource_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="resource_not_found")
    return row


@router.get("", response_model=AdminResourceListResponse)
async def list_resources(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
    course_id: int | None = Query(default=None, gt=0),
    term_code: str | None = Query(default=None, max_length=32),
    resource_type: str | None = Query(default=None, max_length=32),
    visible: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminResourceListResponse:
    base_query = _resource_query(course_id, term_code, resource_type, visible)
    total = await db.scalar(select(func.count()).select_from(base_query.subquery()))
    rows = await db.execute(
        base_query.order_by(CourseResource.updated_at.desc()).limit(limit).offset(offset)
    )
    items = [AdminResourceResponse.model_validate(row) for row in rows.scalars().all()]
    return AdminResourceListResponse(items=items, total=total or 0, limit=limit, offset=offset)


@router.post(
    "",
    response_model=AdminResourceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_csrf)],
)
async def create_resource(
    request: Request,
    body: AdminResourceCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminResourceResponse:
    course_exists = await db.scalar(
        select(func.count()).select_from(Course).where(Course.id == body.course_id)
    )
    if not course_exists:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="course_not_found"
        )

    row = CourseResource(
        course_id=body.course_id,
        title=body.title,
        url=body.url,
        resource_type=body.resource_type,
        term_code=body.term_code.strip() if body.term_code else None,
        description=body.description.strip() if body.description else None,
        is_visible=body.is_visible,
        created_by=admin.id,
        updated_by=admin.id,
    )
    db.add(row)
    await db.flush()
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.resource.created",
        target_type="course_resource",
        target_id=str(row.id),
        payload={"course_id": row.course_id, "resource_type": row.resource_type},
        ip_address=_client_ip(request),
    )
    await db.commit()
    await db.refresh(row)
    return AdminResourceResponse.model_validate(row)


@router.get("/{resource_id}", response_model=AdminResourceResponse)
async def get_resource(
    resource_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminResourceResponse:
    row = await _get_resource_or_404(db, resource_id)
    return AdminResourceResponse.model_validate(row)


@router.patch(
    "/{resource_id}",
    response_model=AdminResourceResponse,
    dependencies=[Depends(require_admin_csrf)],
)
async def update_resource(
    resource_id: int,
    request: Request,
    body: AdminResourceUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminResourceResponse:
    row = await _get_resource_or_404(db, resource_id)
    changes = body.model_dump(exclude_unset=True)
    if changes:
        before = {
            "title": row.title,
            "url": row.url,
            "resource_type": row.resource_type,
            "term_code": row.term_code,
            "is_visible": row.is_visible,
        }
        for key, value in changes.items():
            if key in {"term_code", "description"} and isinstance(value, str):
                setattr(row, key, value.strip())
            else:
                setattr(row, key, value)
        row.updated_by = admin.id
        await record_audit(
            db,
            actor_type="admin",
            actor_id=admin.id,
            action="admin.resource.updated",
            target_type="course_resource",
            target_id=str(row.id),
            payload={
                "before": before,
                "after": {
                    "title": row.title,
                    "url": row.url,
                    "resource_type": row.resource_type,
                    "term_code": row.term_code,
                    "is_visible": row.is_visible,
                },
            },
            ip_address=_client_ip(request),
        )
        await db.commit()
        await db.refresh(row)
    return AdminResourceResponse.model_validate(row)

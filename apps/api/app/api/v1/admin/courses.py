from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import Select, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security.audit import record_audit
from app.db.models.academic import (
    Course,
    CoursePrerequisite,
    CourseResource,
    CurriculumCourse,
    Enrollment,
    Exam,
    Schedule,
    TermCourseOffering,
    TermExamSchedule,
)
from app.db.models.core_security import AdminUser
from app.deps import get_current_admin, get_db, require_admin_csrf
from app.schemas.admin.courses import (
    AdminCourseCreateRequest,
    AdminCourseDetailResponse,
    AdminCourseListItem,
    AdminCourseListResponse,
    AdminCoursePrerequisitesRequest,
    AdminCourseUpdateRequest,
)

router = APIRouter(prefix="/admin/courses", tags=["admin-courses"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _course_query(
    search: str | None, kind: str | None, difficulty: str | None
) -> Select[tuple[Course]]:
    query = select(Course)
    if search:
        token = f"%{search.strip()}%"
        query = query.where(or_(Course.code.ilike(token), Course.name.ilike(token)))
    if kind:
        query = query.where(Course.kind == kind.strip().lower())
    if difficulty:
        query = query.where(Course.difficulty == difficulty.strip().lower())
    return query


async def _load_prerequisites(db: AsyncSession, course_id: int) -> list[dict]:
    rows = await db.execute(
        select(CoursePrerequisite)
        .where(CoursePrerequisite.course_id == course_id)
        .order_by(CoursePrerequisite.prerequisite_id.asc())
    )
    return [{"prerequisite_id": r.prerequisite_id, "kind": r.kind} for r in rows.scalars().all()]


async def _assert_no_prerequisite_cycle(
    db: AsyncSession, course_id: int, new_prereq_ids: list[int]
) -> None:
    if course_id in new_prereq_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "self_prerequisite_not_allowed"},
        )

    res = await db.execute(select(CoursePrerequisite.course_id, CoursePrerequisite.prerequisite_id))
    graph: dict[int, set[int]] = {}
    for src, dst in res.all():
        graph.setdefault(src, set()).add(dst)
    graph[course_id] = set(new_prereq_ids)

    visiting: set[int] = set()
    visited: set[int] = set()

    def dfs(node: int) -> bool:
        if node in visiting:
            return True
        if node in visited:
            return False
        visiting.add(node)
        for nxt in graph.get(node, set()):
            if dfs(nxt):
                return True
        visiting.remove(node)
        visited.add(node)
        return False

    if dfs(course_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "prerequisite_cycle_detected"},
        )


@router.get("", response_model=AdminCourseListResponse)
async def list_courses(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
    search: str | None = Query(default=None, max_length=128),
    kind: str | None = Query(default=None, max_length=32),
    difficulty: str | None = Query(default=None, max_length=16),
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> AdminCourseListResponse:
    base_query = _course_query(search, kind, difficulty)
    total = await db.scalar(select(func.count()).select_from(base_query.subquery()))
    rows = await db.execute(base_query.order_by(Course.code.asc()).limit(limit).offset(offset))
    items = [AdminCourseListItem.model_validate(row) for row in rows.scalars().all()]
    return AdminCourseListResponse(items=items, total=total or 0, limit=limit, offset=offset)


@router.post(
    "",
    response_model=AdminCourseDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_csrf)],
)
async def create_course(
    request: Request,
    body: AdminCourseCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminCourseDetailResponse:
    row = Course(
        code=body.code,
        name=body.name,
        credits=body.credits,
        kind=body.kind,
        difficulty=body.difficulty,
        admin_locked=True,
        admin_updated_at=datetime.now(UTC),
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "course_code_exists"},
        ) from exc

    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.course.created",
        target_type="course",
        target_id=str(row.id),
        payload={"code": row.code, "name": row.name},
        ip_address=_client_ip(request),
    )
    await db.commit()
    await db.refresh(row)
    return AdminCourseDetailResponse.model_validate({**row.__dict__, "prerequisites": []})


async def _get_course_or_404(db: AsyncSession, course_id: int) -> Course:
    res = await db.execute(select(Course).where(Course.id == course_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="course_not_found")
    return row


@router.get("/{course_id}", response_model=AdminCourseDetailResponse)
async def get_course(
    course_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminCourseDetailResponse:
    row = await _get_course_or_404(db, course_id)
    prerequisites = await _load_prerequisites(db, course_id)
    return AdminCourseDetailResponse.model_validate(
        {**row.__dict__, "prerequisites": prerequisites}
    )


@router.patch(
    "/{course_id}",
    response_model=AdminCourseDetailResponse,
    dependencies=[Depends(require_admin_csrf)],
)
async def update_course(
    course_id: int,
    request: Request,
    body: AdminCourseUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminCourseDetailResponse:
    row = await _get_course_or_404(db, course_id)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        prerequisites = await _load_prerequisites(db, course_id)
        return AdminCourseDetailResponse.model_validate(
            {**row.__dict__, "prerequisites": prerequisites}
        )

    before = {
        "code": row.code,
        "name": row.name,
        "credits": row.credits,
        "kind": row.kind,
        "difficulty": row.difficulty,
        "is_active": row.is_active,
    }
    for key, value in changes.items():
        setattr(row, key, value)
    row.admin_locked = True
    row.admin_updated_at = datetime.now(UTC)

    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "course_code_exists"},
        ) from exc

    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.course.updated",
        target_type="course",
        target_id=str(row.id),
        payload={
            "before": before,
            "after": {
                "code": row.code,
                "name": row.name,
                "credits": row.credits,
                "kind": row.kind,
                "difficulty": row.difficulty,
                "is_active": row.is_active,
            },
        },
        ip_address=_client_ip(request),
    )
    await db.commit()
    await db.refresh(row)
    prerequisites = await _load_prerequisites(db, row.id)
    return AdminCourseDetailResponse.model_validate(
        {**row.__dict__, "prerequisites": prerequisites}
    )


async def _course_usage_refs(db: AsyncSession, course_id: int) -> dict[str, int]:
    return {
        "prerequisite_links": int(
            await db.scalar(
                select(func.count())
                .select_from(CoursePrerequisite)
                .where(
                    or_(
                        CoursePrerequisite.course_id == course_id,
                        CoursePrerequisite.prerequisite_id == course_id,
                    )
                )
            )
            or 0
        ),
        "curriculum_links": int(
            await db.scalar(
                select(func.count())
                .select_from(CurriculumCourse)
                .where(CurriculumCourse.course_id == course_id)
            )
            or 0
        ),
        "resources": int(
            await db.scalar(
                select(func.count())
                .select_from(CourseResource)
                .where(CourseResource.course_id == course_id)
            )
            or 0
        ),
        "enrollments": int(
            await db.scalar(
                select(func.count())
                .select_from(Enrollment)
                .where(Enrollment.course_id == course_id)
            )
            or 0
        ),
        "schedules": int(
            await db.scalar(
                select(func.count()).select_from(Schedule).where(Schedule.course_id == course_id)
            )
            or 0
        ),
        "exams": int(
            await db.scalar(
                select(func.count()).select_from(Exam).where(Exam.course_id == course_id)
            )
            or 0
        ),
        "term_offerings": int(
            await db.scalar(
                select(func.count())
                .select_from(TermCourseOffering)
                .where(TermCourseOffering.course_id == course_id)
            )
            or 0
        ),
        "term_exams": int(
            await db.scalar(
                select(func.count())
                .select_from(TermExamSchedule)
                .where(TermExamSchedule.course_id == course_id)
            )
            or 0
        ),
    }


@router.delete(
    "/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[Depends(require_admin_csrf)],
)
async def delete_course(
    course_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> Response:
    row = await _get_course_or_404(db, course_id)
    refs = await _course_usage_refs(db, course_id)
    blocking_refs = {k: v for k, v in refs.items() if v > 0}
    if blocking_refs:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "course_in_use", "references": blocking_refs},
        )

    await db.execute(delete(Course).where(Course.id == course_id))
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.course.deleted",
        target_type="course",
        target_id=str(course_id),
        payload={"code": row.code},
        ip_address=_client_ip(request),
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/{course_id}/prerequisites",
    response_model=AdminCourseDetailResponse,
    dependencies=[Depends(require_admin_csrf)],
)
async def set_course_prerequisites(
    course_id: int,
    request: Request,
    body: AdminCoursePrerequisitesRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminCourseDetailResponse:
    row = await _get_course_or_404(db, course_id)

    seen = set()
    deduped_prereqs = []
    for p in body.prerequisites:
        if p.prerequisite_id not in seen:
            seen.add(p.prerequisite_id)
            deduped_prereqs.append(p)

    deduped_prereq_ids = [p.prerequisite_id for p in deduped_prereqs]

    if deduped_prereq_ids:
        res = await db.execute(select(Course.id).where(Course.id.in_(deduped_prereq_ids)))
        found_ids = set(res.scalars().all())
        missing_ids = [cid for cid in deduped_prereq_ids if cid not in found_ids]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "prerequisite_course_not_found", "missing_ids": missing_ids},
            )

    await _assert_no_prerequisite_cycle(db, course_id, deduped_prereq_ids)

    current_prereqs = await _load_prerequisites(db, course_id)
    await db.execute(delete(CoursePrerequisite).where(CoursePrerequisite.course_id == course_id))
    for p in deduped_prereqs:
        db.add(
            CoursePrerequisite(course_id=course_id, prerequisite_id=p.prerequisite_id, kind=p.kind)
        )

    row.admin_locked = True
    row.admin_updated_at = datetime.now(UTC)
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.course.prerequisites_set",
        target_type="course",
        target_id=str(course_id),
        payload={"before": current_prereqs, "after": [p.model_dump() for p in deduped_prereqs]},
        ip_address=_client_ip(request),
    )
    await db.commit()
    await db.refresh(row)
    return AdminCourseDetailResponse.model_validate(
        {**row.__dict__, "prerequisites": [p.model_dump() for p in deduped_prereqs]}
    )

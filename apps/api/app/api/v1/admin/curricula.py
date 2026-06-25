from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import Select, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security.audit import record_audit
from app.db.models.academic import (
    Course,
    Curriculum,
    CurriculumCourse,
    CurriculumTerm,
    ElectiveGroup,
    ElectiveGroupCourse,
)
from app.db.models.core_security import AdminUser, Major
from app.deps import get_current_admin, get_db, require_admin_csrf
from app.schemas.admin.curricula import (
    AdminCurriculumCreateRequest,
    AdminCurriculumDetailResponse,
    AdminCurriculumListItem,
    AdminCurriculumListResponse,
    AdminCurriculumStructureRequest,
    AdminCurriculumTermCourseResponse,
    AdminCurriculumTermResponse,
    AdminCurriculumUpdateRequest,
    AdminElectiveGroupResponse,
    AdminMajorListItem,
    AdminMajorListResponse,
)

router = APIRouter(prefix="/admin/curricula", tags=["admin-curricula"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def _get_curriculum_or_404(db: AsyncSession, curriculum_id: int) -> Curriculum:
    res = await db.execute(select(Curriculum).where(Curriculum.id == curriculum_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="curriculum_not_found")
    return row


async def _load_curriculum_detail(
    db: AsyncSession, curriculum: Curriculum
) -> AdminCurriculumDetailResponse:
    term_rows = await db.execute(
        select(CurriculumTerm)
        .where(CurriculumTerm.curriculum_id == curriculum.id)
        .order_by(CurriculumTerm.term_number.asc())
    )
    terms = list(term_rows.scalars().all())
    term_ids = [t.id for t in terms]

    cc_map: dict[int, list[AdminCurriculumTermCourseResponse]] = {t.id: [] for t in terms}
    if term_ids:
        cc_rows = await db.execute(
            select(CurriculumCourse).where(CurriculumCourse.curriculum_term_id.in_(term_ids))
        )
        for row in cc_rows.scalars().all():
            cc_map[row.curriculum_term_id].append(
                AdminCurriculumTermCourseResponse(
                    course_id=row.course_id, is_required=row.is_required
                )
            )
        for courses in cc_map.values():
            courses.sort(key=lambda c: c.course_id)

    group_rows = await db.execute(
        select(ElectiveGroup)
        .where(ElectiveGroup.curriculum_id == curriculum.id)
        .order_by(ElectiveGroup.id.asc())
    )
    groups = list(group_rows.scalars().all())
    group_ids = [g.id for g in groups]
    group_course_map: dict[int, list[int]] = {g.id: [] for g in groups}
    if group_ids:
        egc_rows = await db.execute(
            select(ElectiveGroupCourse).where(ElectiveGroupCourse.elective_group_id.in_(group_ids))
        )
        for row in egc_rows.scalars().all():
            group_course_map[row.elective_group_id].append(row.course_id)
        for course_ids in group_course_map.values():
            course_ids.sort()

    return AdminCurriculumDetailResponse(
        id=curriculum.id,
        major_id=curriculum.major_id,
        name=curriculum.name,
        effective_year=curriculum.effective_year,
        total_credits=curriculum.total_credits,
        is_active=curriculum.is_active,
        terms=[
            AdminCurriculumTermResponse(
                id=t.id,
                term_number=t.term_number,
                courses=cc_map.get(t.id, []),
            )
            for t in terms
        ],
        elective_groups=[
            AdminElectiveGroupResponse(
                id=g.id,
                name=g.name,
                rule_type=g.rule_type,
                required_value=g.required_value,
                course_ids=group_course_map.get(g.id, []),
            )
            for g in groups
        ],
    )


def _curriculum_query(
    major_id: int | None, effective_year: int | None
) -> Select[tuple[Curriculum]]:
    query = select(Curriculum)
    if major_id:
        query = query.where(Curriculum.major_id == major_id)
    if effective_year:
        query = query.where(Curriculum.effective_year == effective_year)
    return query


@router.get("", response_model=AdminCurriculumListResponse)
async def list_curricula(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
    major_id: int | None = Query(default=None, gt=0),
    effective_year: int | None = Query(default=None, ge=2000, le=2100),
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> AdminCurriculumListResponse:
    base_query = _curriculum_query(major_id, effective_year)
    total = await db.scalar(select(func.count()).select_from(base_query.subquery()))
    rows = await db.execute(
        base_query.order_by(Curriculum.effective_year.desc(), Curriculum.id.asc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        AdminCurriculumListItem(
            id=row.id,
            major_id=row.major_id,
            name=row.name,
            effective_year=row.effective_year,
            total_credits=row.total_credits,
            is_active=row.is_active,
        )
        for row in rows.scalars().all()
    ]
    return AdminCurriculumListResponse(items=items, total=total or 0, limit=limit, offset=offset)


@router.get("/majors", response_model=AdminMajorListResponse)
async def list_majors(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminMajorListResponse:
    res = await db.execute(select(Major).order_by(Major.name.asc()))
    rows = res.scalars().all()
    items = [AdminMajorListItem(id=row.id, code=row.code, name=row.name) for row in rows]
    return AdminMajorListResponse(items=items)


@router.post(
    "",
    response_model=AdminCurriculumDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_csrf)],
)
async def create_curriculum(
    request: Request,
    body: AdminCurriculumCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminCurriculumDetailResponse:
    # Resolve major: by ID or find-or-create by code
    if body.major_id is not None:
        res = await db.execute(select(Major).where(Major.id == body.major_id).limit(1))
        major = res.scalar_one_or_none()
        if major is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="major_not_found"
            )
    else:
        res = await db.execute(select(Major).where(Major.code == body.major_code).limit(1))
        major = res.scalar_one_or_none()
        if major is None:
            major = Major(code=body.major_code, name=body.major_name)
            db.add(major)
            await db.flush()

    row = Curriculum(
        major_id=major.id,
        name=body.name,
        effective_year=body.effective_year,
        total_credits=body.total_credits,
    )
    db.add(row)
    await db.flush()
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.curriculum.created",
        target_type="curriculum",
        target_id=str(row.id),
        payload={"major_id": row.major_id, "effective_year": row.effective_year},
        ip_address=_client_ip(request),
    )
    await db.commit()
    return await _load_curriculum_detail(db, row)


@router.get("/{curriculum_id}", response_model=AdminCurriculumDetailResponse)
async def get_curriculum(
    curriculum_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminCurriculumDetailResponse:
    row = await _get_curriculum_or_404(db, curriculum_id)
    return await _load_curriculum_detail(db, row)


@router.patch(
    "/{curriculum_id}",
    response_model=AdminCurriculumDetailResponse,
    dependencies=[Depends(require_admin_csrf)],
)
async def update_curriculum(
    curriculum_id: int,
    request: Request,
    body: AdminCurriculumUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminCurriculumDetailResponse:
    row = await _get_curriculum_or_404(db, curriculum_id)
    changes = body.model_dump(exclude_unset=True)
    if changes:
        before = {
            "name": row.name,
            "effective_year": row.effective_year,
            "total_credits": row.total_credits,
            "is_active": row.is_active,
        }
        for key, value in changes.items():
            setattr(row, key, value)
        await record_audit(
            db,
            actor_type="admin",
            actor_id=admin.id,
            action="admin.curriculum.updated",
            target_type="curriculum",
            target_id=str(row.id),
            payload={
                "before": before,
                "after": {
                    "name": row.name,
                    "effective_year": row.effective_year,
                    "total_credits": row.total_credits,
                    "is_active": row.is_active,
                },
            },
            ip_address=_client_ip(request),
        )
        await db.commit()
    return await _load_curriculum_detail(db, row)


@router.delete(
    "/{curriculum_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[Depends(require_admin_csrf)],
)
async def delete_curriculum(
    curriculum_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> Response:
    row = await _get_curriculum_or_404(db, curriculum_id)
    await db.execute(delete(Curriculum).where(Curriculum.id == curriculum_id))
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.curriculum.deleted",
        target_type="curriculum",
        target_id=str(curriculum_id),
        payload={"name": row.name},
        ip_address=_client_ip(request),
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/{curriculum_id}/structure",
    response_model=AdminCurriculumDetailResponse,
    dependencies=[Depends(require_admin_csrf)],
)
async def replace_curriculum_structure(
    curriculum_id: int,
    request: Request,
    body: AdminCurriculumStructureRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminCurriculumDetailResponse:
    row = await _get_curriculum_or_404(db, curriculum_id)

    term_numbers = [t.term_number for t in body.terms]
    if len(set(term_numbers)) != len(term_numbers):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "duplicate_term_number"},
        )

    all_course_ids: set[int] = set()
    for term in body.terms:
        for c in term.courses:
            all_course_ids.add(c.course_id)
    for group in body.elective_groups:
        if len(set(group.course_ids)) != len(group.course_ids):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "duplicate_elective_group_course_ids"},
            )
        for course_id in group.course_ids:
            all_course_ids.add(course_id)

    if all_course_ids:
        res = await db.execute(select(Course.id).where(Course.id.in_(all_course_ids)))
        found_ids = set(res.scalars().all())
        missing_ids = sorted([cid for cid in all_course_ids if cid not in found_ids])
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": "course_not_found", "missing_ids": missing_ids},
            )

    # group courses phải nằm trong curriculum terms để tránh group mồ côi.
    term_course_ids = {c.course_id for term in body.terms for c in term.courses}
    for group in body.elective_groups:
        outside_ids = sorted([cid for cid in group.course_ids if cid not in term_course_ids])
        if outside_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "elective_group_course_outside_curriculum",
                    "group_name": group.name,
                    "outside_ids": outside_ids,
                },
            )

    existing_terms = await db.execute(
        select(CurriculumTerm.id).where(CurriculumTerm.curriculum_id == curriculum_id)
    )
    existing_term_ids = list(existing_terms.scalars().all())
    if existing_term_ids:
        await db.execute(
            delete(CurriculumCourse).where(
                CurriculumCourse.curriculum_term_id.in_(existing_term_ids)
            )
        )
    await db.execute(delete(CurriculumTerm).where(CurriculumTerm.curriculum_id == curriculum_id))

    existing_groups = await db.execute(
        select(ElectiveGroup.id).where(ElectiveGroup.curriculum_id == curriculum_id)
    )
    existing_group_ids = list(existing_groups.scalars().all())
    if existing_group_ids:
        await db.execute(
            delete(ElectiveGroupCourse).where(
                ElectiveGroupCourse.elective_group_id.in_(existing_group_ids)
            )
        )
    await db.execute(delete(ElectiveGroup).where(ElectiveGroup.curriculum_id == curriculum_id))

    for term in body.terms:
        term_row = CurriculumTerm(curriculum_id=curriculum_id, term_number=term.term_number)
        db.add(term_row)
        await db.flush()
        for c in term.courses:
            db.add(
                CurriculumCourse(
                    curriculum_term_id=term_row.id,
                    course_id=c.course_id,
                    is_required=c.is_required,
                )
            )

    for group in body.elective_groups:
        group_row = ElectiveGroup(
            curriculum_id=curriculum_id,
            name=group.name,
            rule_type=group.rule_type,
            required_value=group.required_value,
        )
        db.add(group_row)
        await db.flush()
        for course_id in group.course_ids:
            db.add(ElectiveGroupCourse(elective_group_id=group_row.id, course_id=course_id))

    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.curriculum.structure_replaced",
        target_type="curriculum",
        target_id=str(curriculum_id),
        payload={
            "term_count": len(body.terms),
            "elective_group_count": len(body.elective_groups),
        },
        ip_address=_client_ip(request),
    )
    await db.commit()
    return await _load_curriculum_detail(db, row)

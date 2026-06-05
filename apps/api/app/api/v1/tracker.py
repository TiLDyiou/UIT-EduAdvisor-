"""Milestone 3 – Academic Tracker & GPA Suite endpoints."""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.academic import (
    Course,
    CoursePrerequisite,
    Curriculum,
    CurriculumCourse,
    CurriculumTerm,
    ElectiveGroup,
    ElectiveGroupCourse,
    Enrollment,
)
from app.db.models.core_security import Student, SyncJob
from app.deps import get_current_student, get_db
from app.schemas.m3 import (
    ElectiveGroupStatusResponse,
    GpaOverviewResponse,
    GpaSimulateRequest,
    GpaSimulateResponse,
    RetakeEstimateRequest,
    RetakeEstimateResponse,
    ReverseCalculateRequest,
    ReverseCalculateResponse,
    RoadmapNodeResponse,
    RoadmapResponse,
)
from app.services.academic.gpa import (
    EnrollmentRow,
    compute_cumulative_gpa,
    grade_10_to_letter,
    retake_estimate,
    reverse_calculate,
    simulate_gpa,
)
from app.services.academic.roadmap import (
    CourseInfo,
    CurriculumEntry,
    ElectiveGroupRule,
    EnrollmentInfo,
    PrerequisiteEdge,
    compute_elective_group_statuses,
    resolve_roadmap,
)

router = APIRouter(prefix="/tracker", tags=["tracker"])


# ---------------------------------------------------------------------------
# Helpers – load data from DB
# ---------------------------------------------------------------------------

async def _load_enrollments(db: AsyncSession, student_id) -> list[Enrollment]:
    """Load all enrollments for a student, eagerly loading related course."""
    res = await db.execute(
        select(Enrollment)
        .options(selectinload(Enrollment.course))
        .where(Enrollment.student_id == student_id)
    )
    return list(res.scalars().all())


async def _find_curriculum(db: AsyncSession, student: Student) -> Curriculum | None:
    """Find the best matching curriculum for a student's major."""
    res = await db.execute(
        select(Curriculum)
        .where(Curriculum.major_id == student.major_id)
        .order_by(Curriculum.effective_year.desc())
        .limit(1)
    )
    return res.scalar_one_or_none()


def _enrollment_to_row(e: Enrollment) -> EnrollmentRow:
    return EnrollmentRow(
        credits=e.course.credits if e.course else 0,
        final_grade_10=e.final_grade_10,
    )


# ---------------------------------------------------------------------------
# GPA endpoints
# ---------------------------------------------------------------------------

@router.get("/gpa", response_model=GpaOverviewResponse)
async def gpa_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
) -> GpaOverviewResponse:
    enrollments = await _load_enrollments(db, student.id)
    rows = [_enrollment_to_row(e) for e in enrollments]
    result = compute_cumulative_gpa(rows)

    # Get official DAA GPAs from the latest successful onboarding SyncJob
    res = await db.execute(
        select(SyncJob)
        .where(
            SyncJob.student_id == student.id,
            SyncJob.status == "completed",
            SyncJob.kind == "onboarding",
        )
        .order_by(SyncJob.finished_at.desc())
        .limit(1)
    )
    job = res.scalar_one_or_none()

    daa_dtbc_10 = None
    daa_dtbc_4 = None
    daa_dtbctl_10 = None
    daa_dtbctl_4 = None
    daa_earned_credits = None

    if job and job.result_summary:
        daa_dtbc_10 = job.result_summary.get("daa_dtbc_10")
        daa_dtbc_4 = job.result_summary.get("daa_dtbc_4")
        daa_dtbctl_10 = job.result_summary.get("daa_dtbctl_10")
        daa_dtbctl_4 = job.result_summary.get("daa_dtbctl_4")
        daa_earned_credits = job.result_summary.get("daa_earned_credits")

    return GpaOverviewResponse(
        gpa_10=result.gpa_10,
        gpa_4=result.gpa_4,
        total_credits=result.total_credits,
        earned_credits=result.earned_credits,
        daa_dtbc_10=daa_dtbc_10,
        daa_dtbc_4=daa_dtbc_4,
        daa_dtbctl_10=daa_dtbctl_10,
        daa_dtbctl_4=daa_dtbctl_4,
        daa_earned_credits=daa_earned_credits,
    )


@router.post("/gpa/simulate", response_model=GpaSimulateResponse)
async def gpa_simulate(
    body: GpaSimulateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
) -> GpaSimulateResponse:
    enrollments = await _load_enrollments(db, student.id)
    current_rows = [_enrollment_to_row(e) for e in enrollments]
    hypo_rows = [
        EnrollmentRow(credits=entry.credits, final_grade_10=entry.hypothetical_grade_10)
        for entry in body.entries
    ]
    current_result = compute_cumulative_gpa(current_rows)
    simulated_result = simulate_gpa(current_rows, hypo_rows)

    return GpaSimulateResponse(
        current=GpaOverviewResponse(
            gpa_10=current_result.gpa_10,
            gpa_4=current_result.gpa_4,
            total_credits=current_result.total_credits,
            earned_credits=current_result.earned_credits,
        ),
        simulated=GpaOverviewResponse(
            gpa_10=simulated_result.gpa_10,
            gpa_4=simulated_result.gpa_4,
            total_credits=simulated_result.total_credits,
            earned_credits=simulated_result.earned_credits,
        ),
    )


@router.post("/gpa/reverse", response_model=ReverseCalculateResponse)
async def gpa_reverse(
    body: ReverseCalculateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
) -> ReverseCalculateResponse:
    enrollments = await _load_enrollments(db, student.id)
    rows = [_enrollment_to_row(e) for e in enrollments]
    current = compute_cumulative_gpa(rows)
    result = reverse_calculate(
        current_gpa_10=current.gpa_10,
        earned_credits=current.total_credits,
        target_gpa_10=body.target_gpa_10,
        remaining_credits=body.remaining_credits,
    )
    return ReverseCalculateResponse(
        required_avg_10=result.required_avg_10,
        required_avg_4=result.required_avg_4,
        achievable=result.achievable,
    )


@router.post("/gpa/retake", response_model=RetakeEstimateResponse)
async def gpa_retake(
    body: RetakeEstimateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
) -> RetakeEstimateResponse:
    enrollments = await _load_enrollments(db, student.id)
    # Find the enrollment by ID
    idx = None
    for i, e in enumerate(enrollments):
        if e.id == body.enrollment_id:
            idx = i
            break
    if idx is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="enrollment_not_found",
        )

    rows = [_enrollment_to_row(e) for e in enrollments]
    result = retake_estimate(rows, idx, body.new_grade_10)
    return RetakeEstimateResponse(
        old_gpa_10=result.old_gpa_10,
        new_gpa_10=result.new_gpa_10,
        delta_gpa_10=result.delta_gpa_10,
        old_gpa_4=result.old_gpa_4,
        new_gpa_4=result.new_gpa_4,
        delta_gpa_4=result.delta_gpa_4,
    )


# ---------------------------------------------------------------------------
# Roadmap endpoint
# ---------------------------------------------------------------------------

@router.get("/roadmap", response_model=RoadmapResponse)
async def roadmap(
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
) -> RoadmapResponse:
    curriculum = await _find_curriculum(db, student)
    if curriculum is None:
        # No curriculum defined yet → empty preview
        return RoadmapResponse(nodes=[], elective_groups=[], is_preview=True)

    # Load curriculum terms + courses
    terms_res = await db.execute(
        select(CurriculumTerm)
        .options(
            selectinload(CurriculumTerm.curriculum_courses).selectinload(CurriculumCourse.course)
        )
        .where(CurriculumTerm.curriculum_id == curriculum.id)
        .order_by(CurriculumTerm.term_number)
    )
    terms = list(terms_res.scalars().all())

    # Load elective groups
    eg_res = await db.execute(
        select(ElectiveGroup)
        .options(selectinload(ElectiveGroup.elective_group_courses))
        .where(ElectiveGroup.curriculum_id == curriculum.id)
    )
    elective_groups_db = list(eg_res.scalars().all())

    # Build elective_group membership: course_id → (group_id, group_name)
    eg_membership: dict[int, tuple[int, str]] = {}
    for eg in elective_groups_db:
        for egc in eg.elective_group_courses:
            eg_membership[egc.course_id] = (eg.id, eg.name)

    # Build CurriculumEntry list
    curriculum_entries: list[CurriculumEntry] = []
    for term in terms:
        for cc in term.curriculum_courses:
            c = cc.course
            eg_info = eg_membership.get(c.id)
            curriculum_entries.append(
                CurriculumEntry(
                    course=CourseInfo(
                        course_id=c.id,
                        code=c.code,
                        name=c.name,
                        credits=c.credits,
                    ),
                    term_number=term.term_number,
                    is_required=cc.is_required,
                    elective_group_id=eg_info[0] if eg_info else None,
                    elective_group_name=eg_info[1] if eg_info else None,
                )
            )

    # Load student enrollments
    enrollments = await _load_enrollments(db, student.id)
    # Determine current term (latest term_code among enrollments with no grade)
    current_terms: set[str] = set()
    for e in enrollments:
        if e.final_grade_10 is None:
            current_terms.add(e.term_code)

    enrollment_infos = [
        EnrollmentInfo(
            course_id=e.course_id,
            final_grade_10=e.final_grade_10,
            is_current_term=e.term_code in current_terms,
        )
        for e in enrollments
    ]

    is_preview = len(enrollments) == 0

    # Load prerequisites
    course_ids = {entry.course.course_id for entry in curriculum_entries}
    prereq_res = await db.execute(
        select(CoursePrerequisite).where(CoursePrerequisite.course_id.in_(course_ids))
    )
    prereq_edges = [
        PrerequisiteEdge(
            course_id=p.course_id,
            prerequisite_course_id=p.prerequisite_id,
        )
        for p in prereq_res.scalars().all()
    ]

    # Resolve roadmap
    nodes = resolve_roadmap(curriculum_entries, enrollment_infos, prereq_edges)

    # Elective group statuses
    eg_rules = [
        ElectiveGroupRule(
            group_id=eg.id,
            group_name=eg.name,
            rule_type=eg.rule_type,
            required_value=eg.required_value,
            course_ids=[egc.course_id for egc in eg.elective_group_courses],
        )
        for eg in elective_groups_db
    ]
    credit_map = {entry.course.course_id: entry.course.credits for entry in curriculum_entries}
    eg_statuses = compute_elective_group_statuses(eg_rules, enrollment_infos, credit_map)

    # Build response
    node_responses = [
        RoadmapNodeResponse(
            course_id=n.course_id,
            course_code=n.course_code,
            course_name=n.course_name,
            credits=n.credits,
            term_number=n.term_number,
            status=n.status,
            grade_10=n.grade_10,
            grade_4=n.grade_4,
            grade_letter=grade_10_to_letter(n.grade_10) if n.grade_10 is not None else None,
            prerequisites_met=n.prerequisites_met,
            missing_prerequisites=n.missing_prerequisites,
            elective_group_id=n.elective_group_id,
            elective_group_name=n.elective_group_name,
            is_required=n.is_required,
        )
        for n in nodes
    ]

    eg_responses = [
        ElectiveGroupStatusResponse(
            group_id=s.group_id,
            group_name=s.group_name,
            rule_type=s.rule_type,
            required_value=s.required_value,
            current_value=s.current_value,
            fulfilled=s.fulfilled,
        )
        for s in eg_statuses
    ]

    return RoadmapResponse(
        nodes=node_responses,
        elective_groups=eg_responses,
        is_preview=is_preview,
    )

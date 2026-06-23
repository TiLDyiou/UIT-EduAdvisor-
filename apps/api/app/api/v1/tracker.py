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
    RoadmapNodeResponse,
    RoadmapResponse,
)
from app.services.academic.gpa import (
    EnrollmentRow,
    compute_cumulative_gpa,
    grade_10_to_letter,
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
        .options(selectinload(Enrollment.course), selectinload(Enrollment.grades))
        .where(Enrollment.student_id == student_id)
    )
    return list(res.scalars().all())


async def _find_curriculum(db: AsyncSession, student: Student) -> Curriculum | None:
    """Find the best matching curriculum for a student's major and enrollment year."""
    from sqlalchemy import or_, and_
    from app.db.models.core_security import Major
    
    major_prefix = ""
    if student.major_id:
        res_m = await db.execute(select(Major).where(Major.id == student.major_id))
        m = res_m.scalar_one_or_none()
        if m:
            from app.services.daa.parser import MAJOR_MAPPING
            for k, v in MAJOR_MAPPING.items():
                if v.lower() == m.name.lower():
                    major_prefix = k
                    break

    conditions = []
    if student.major_id:
        conditions.append(Curriculum.major_id == student.major_id)

    # Handle cases where admin abbreviated the major and cohort (e.g. ATTT K19)
    if major_prefix:
        name_conds = [Curriculum.name.ilike(f"%{major_prefix}%")]
        if student.enrollment_year:
            k_cohort = f"K{student.enrollment_year - 2005}"
            name_conds.append(Curriculum.name.ilike(f"%{k_cohort}%"))
        conditions.append(and_(*name_conds))

    if not conditions:
        return None

    query = select(Curriculum).where(or_(*conditions))
    
    # Compare effective_year
    if student.enrollment_year:
        query = query.where(
            or_(
                Curriculum.effective_year <= student.enrollment_year,
                Curriculum.effective_year.is_(None)
            )
        )
    
    query = query.order_by(Curriculum.effective_year.desc().nullslast()).limit(1)
    res = await db.execute(query)
    return res.scalar_one_or_none()


def _enrollment_to_row(e: Enrollment) -> EnrollmentRow:
    return EnrollmentRow(
        credits=e.course.credits or 0 if e.course else 0,
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
    daa_dtbctl_10 = None
    daa_earned_credits = None

    if job and job.result_summary:
        daa_dtbc_10 = job.result_summary.get("daa_dtbc_10")
        daa_dtbctl_10 = job.result_summary.get("daa_dtbctl_10")
        daa_earned_credits = job.result_summary.get("daa_earned_credits")

    return GpaOverviewResponse(
        gpa_10=result.gpa_10,
        total_credits=result.total_credits,
        earned_credits=result.earned_credits,
        daa_dtbc_10=daa_dtbc_10,
        daa_dtbctl_10=daa_dtbctl_10,
        daa_earned_credits=daa_earned_credits,
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
                        code=c.code or "",
                        name=c.name,
                        credits=c.credits or 0,
                    ),
                    term_number=term.term_number,
                    is_required=cc.is_required,
                    elective_group_id=eg_info[0] if eg_info else None,
                    elective_group_name=eg_info[1] if eg_info else None,
                )
            )

    # Load student enrollments
    enrollments = await _load_enrollments(db, student.id)
    # Determine current term: only the most recent term with no-grade enrollments
    # is the real "current" term. Past terms with exemptions (grade=None) should not
    # be considered current.
    terms_with_no_grade: set[str] = set()
    for e in enrollments:
        if e.final_grade_10 is None and e.term_code:
            terms_with_no_grade.add(e.term_code)

    # The actual current term is "CURRENT" or the latest HK term with no grades
    current_terms: set[str] = set()
    if "CURRENT" in terms_with_no_grade:
        current_terms.add("CURRENT")
    # Find the latest HK term with no grades (e.g., HK2_2025-2026)
    hk_terms = sorted([t for t in terms_with_no_grade if t.startswith("HK")])
    if hk_terms:
        current_terms.add(hk_terms[-1])  # latest term only

    enrollment_infos = [
        EnrollmentInfo(
            course_id=e.course_id,
            final_grade_10=e.final_grade_10,
            is_current_term=e.term_code in current_terms,
            detailed_grades={g.component: float(g.score) for g in e.grades}
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

    # Map DAA term codes to chronological sequence numbers
    enrollment_term_codes: set[str] = set()
    course_actual_term: dict[int, str] = {}  # course_id → term_code
    for e in enrollments:
        if e.term_code and e.term_code != "CURRENT":
            enrollment_term_codes.add(e.term_code)
            course_actual_term[e.course_id] = e.term_code
        elif e.term_code == "CURRENT":
            course_actual_term.setdefault(e.course_id, "CURRENT")

    import re as _re

    def _term_sort_key(tc: str) -> tuple[int, int]:
        m = _re.match(r"HK(\d)_(\d{4})-(\d{4})", tc)
        if m:
            return (int(m.group(2)), int(m.group(1)))  # (start_year, semester)
        return (9999, 9)

    sorted_terms = sorted(enrollment_term_codes, key=_term_sort_key)
    term_code_to_number = {tc: i + 1 for i, tc in enumerate(sorted_terms)}
    current_actual_term = len(sorted_terms) if sorted_terms else 0
    if sorted_terms:
        term_code_to_number["CURRENT"] = current_actual_term
    else:
        term_code_to_number["CURRENT"] = 1
        current_actual_term = 0

    # Build response: Enrolled courses stay where they were taken.
    # Non-enrolled courses that were missed are shifted to the next available term.
    node_responses = []
    pe_terms_used = set()
    max_english_level = 0
    import re
    
    # First pass: record PE courses that are already enrolled, and find max English level
    for n in nodes:
        is_pe = "giáo dục thể chất" in n.course_name.lower()
        if is_pe:
            actual_tc = course_actual_term.get(n.course_id)
            if actual_tc and actual_tc in term_code_to_number:
                pe_terms_used.add(term_code_to_number[actual_tc])
                
        # English detection
        m_eng = re.search(r'(?:anh văn|tiếng anh)\s+(\d+)', n.course_name.lower())
        if m_eng:
            actual_tc = course_actual_term.get(n.course_id)
            if actual_tc: # meaning enrolled (passed or in_progress)
                level = int(m_eng.group(1))
                if level > max_english_level:
                    max_english_level = level

    for n in nodes:
        is_gdqp = "giáo dục quốc phòng" in n.course_name.lower()
        is_pe = "giáo dục thể chất" in n.course_name.lower()
        
        # English skip rule
        m_eng = re.search(r'(?:anh văn|tiếng anh)\s+(\d+)', n.course_name.lower())
        if m_eng:
            level = int(m_eng.group(1))
            if level < max_english_level:
                continue

        actual_tc = course_actual_term.get(n.course_id)
        
        actual_status = n.status
        if is_gdqp:
            actual_term = n.term_number
            if actual_term < current_actual_term:
                actual_status = "passed"
        elif actual_tc and actual_tc in term_code_to_number:
            actual_term = term_code_to_number[actual_tc]
        else:
            actual_term = max(current_actual_term + 1, n.term_number)
            if is_pe:
                while actual_term in pe_terms_used:
                    actual_term += 1
                pe_terms_used.add(actual_term)
            
        node_responses.append(
            RoadmapNodeResponse(
                course_id=n.course_id,
                course_code=n.course_code,
                course_name=n.course_name,
                credits=n.credits,
                term_number=actual_term,
                status=actual_status,
                grade_10=n.grade_10,
                grade_4=n.grade_4,
                grade_letter=grade_10_to_letter(n.grade_10) if n.grade_10 is not None else None,
                prerequisites_met=n.prerequisites_met,
                missing_prerequisites=n.missing_prerequisites,
                elective_group_id=n.elective_group_id,
                elective_group_name=n.elective_group_name,
                is_required=n.is_required,
                detailed_grades=n.detailed_grades,
            )
        )

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
        total_credits=curriculum.total_credits,
        nodes=node_responses,
        elective_groups=eg_responses,
        is_preview=is_preview,
    )

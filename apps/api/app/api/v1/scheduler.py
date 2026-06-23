"""Milestone 5 – UIT Scheduler endpoints."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import Response
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
from app.db.models.core_security import Student
from app.deps import get_current_student, get_db
from app.schemas.m5 import (
    IcsExportRequest,
    RecommendedCourseSchema,
    RecommendResponse,
    ScheduleRequest,
    ScheduleResponse,
    ScheduleSolution,
    SectionSchema,
    SolutionSectionSchema,
    UploadTkbResponse,
)
from app.services.academic.excel_parser import Section, parse_tkb_excel
from app.services.academic.gpa import compute_cumulative_gpa, EnrollmentRow, PASS_THRESHOLD, grade_10_to_4
from app.services.academic.ics_export import generate_ics
from app.services.academic.roadmap import ElectiveGroupRule, EnrollmentInfo
from app.services.academic.scheduler import (
    CandidateCourse,
    StudentContext,
    smart_recommend,
    solve_schedule,
)

router = APIRouter(prefix="/scheduler", tags=["scheduler"])

_MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _section_to_schema(s: Section) -> SectionSchema:
    return SectionSchema(
        course_code=s.course_code,
        section_code=s.section_code,
        course_name=s.course_name,
        credits=s.credits,
        is_lab=s.is_lab,
        teaching_type=s.teaching_type,
        day_of_week=s.day_of_week,
        periods=s.periods,
        biweekly=s.biweekly,
        room=s.room,
        capacity=s.capacity,
        instructor_name=s.instructor_name,
        start_date=s.start_date,
        end_date=s.end_date,
        program=s.program,
        department=s.department,
    )


def _schema_to_section(s: SectionSchema) -> Section:
    return Section(
        course_code=s.course_code,
        section_code=s.section_code,
        course_name=s.course_name,
        credits=s.credits,
        is_lab=s.is_lab,
        teaching_type=s.teaching_type,
        day_of_week=s.day_of_week,
        periods=s.periods,
        biweekly=s.biweekly,
        room=s.room,
        capacity=s.capacity,
        instructor_name=s.instructor_name,
        start_date=s.start_date,
        end_date=s.end_date,
        program=s.program,
        department=s.department,
    )


async def _load_enrollments(db: AsyncSession, student_id) -> list[Enrollment]:
    res = await db.execute(
        select(Enrollment)
        .options(selectinload(Enrollment.course))
        .where(Enrollment.student_id == student_id)
    )
    return list(res.scalars().all())


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload-tkb", response_model=UploadTkbResponse)
async def upload_tkb(file: UploadFile) -> UploadTkbResponse:
    """Upload an Excel TKB file and parse sections."""
    if file.content_type not in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream",
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_file_type",
        )

    data = await file.read()
    if len(data) > _MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="file_too_large",
        )

    try:
        sections = parse_tkb_excel(data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"parse_error: {exc}",
        )

    unique_codes = {s.course_code for s in sections}
    return UploadTkbResponse(
        sections=[_section_to_schema(s) for s in sections],
        total=len(sections),
        unique_courses=len(unique_codes),
    )


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    available_course_codes: list[str] | None = None,
) -> RecommendResponse:
    """Smart Recommendation: score and rank courses for the student."""
    # Load curriculum.
    cur_res = await db.execute(
        select(Curriculum)
        .where(Curriculum.major_id == student.major_id)
        .order_by(Curriculum.effective_year.desc())
        .limit(1)
    )
    curriculum = cur_res.scalar_one_or_none()
    if curriculum is None:
        return RecommendResponse(recommendations=[])

    # Load curriculum terms + courses.
    terms_res = await db.execute(
        select(CurriculumTerm)
        .options(
            selectinload(CurriculumTerm.curriculum_courses).selectinload(CurriculumCourse.course)
        )
        .where(CurriculumTerm.curriculum_id == curriculum.id)
        .order_by(CurriculumTerm.term_number)
    )
    terms = list(terms_res.scalars().all())

    # Load prerequisites.
    all_course_ids = set()
    for t in terms:
        for cc in t.curriculum_courses:
            all_course_ids.add(cc.course_id)

    prereq_res = await db.execute(
        select(CoursePrerequisite).where(CoursePrerequisite.course_id.in_(all_course_ids))
    )
    prereq_map: dict[int, list[int]] = {}
    for p in prereq_res.scalars().all():
        prereq_map.setdefault(p.course_id, []).append(p.prerequisite_id)

    # Load elective groups.
    eg_res = await db.execute(
        select(ElectiveGroup)
        .options(selectinload(ElectiveGroup.elective_group_courses))
        .where(ElectiveGroup.curriculum_id == curriculum.id)
    )
    elective_groups_db = list(eg_res.scalars().all())
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

    # Load student enrollments.
    enrollments = await _load_enrollments(db, student.id)

    # Build student context.
    rows = [
        EnrollmentRow(credits=e.course.credits if e.course else 0, final_grade_10=e.final_grade_10)
        for e in enrollments
    ]
    gpa_result = compute_cumulative_gpa(rows)

    passed_ids: set[int] = set()
    enrolled_ids: set[int] = set()
    grades: dict[int, Decimal] = {}
    enrollment_infos: list[EnrollmentInfo] = []
    current_terms: set[str] = {e.term_code for e in enrollments if e.final_grade_10 is None}

    for e in enrollments:
        if e.final_grade_10 is not None and e.final_grade_10 >= PASS_THRESHOLD:
            passed_ids.add(e.course_id)
        if e.final_grade_10 is None:
            enrolled_ids.add(e.course_id)
        if e.final_grade_10 is not None:
            grades[e.course_id] = e.final_grade_10
        enrollment_infos.append(
            EnrollmentInfo(
                course_id=e.course_id,
                final_grade_10=e.final_grade_10,
                is_current_term=e.term_code in current_terms,
            )
        )

    student_ctx = StudentContext(
        cumulative_gpa_10=gpa_result.gpa_10,
        passed_course_ids=passed_ids,
        enrolled_course_ids=enrolled_ids,
        grades=grades,
    )

    # Build candidate courses.
    credit_map: dict[int, int] = {}
    candidates: list[CandidateCourse] = []
    for t in terms:
        for cc in t.curriculum_courses:
            c = cc.course
            credit_map[c.id] = c.credits
            candidates.append(
                CandidateCourse(
                    course_id=c.id,
                    course_code=c.code,
                    course_name=c.name,
                    credits=c.credits,
                    kind=c.kind,
                    difficulty=c.difficulty,
                    term_number=t.term_number,
                    prerequisite_ids=prereq_map.get(c.id, []),
                )
            )

    available_set = set(available_course_codes) if available_course_codes else None
    scored = smart_recommend(
        candidates, student_ctx, eg_rules, enrollment_infos, credit_map, available_set,
    )

    return RecommendResponse(
        recommendations=[
            RecommendedCourseSchema(
                course_id=sc.course_id,
                course_code=sc.course_code,
                course_name=sc.course_name,
                credits=sc.credits,
                score=sc.score,
                reasons=sc.reasons,
                term_number=sc.term_number,
                difficulty=sc.difficulty,
            )
            for sc in scored
        ]
    )


@router.post("/solve", response_model=ScheduleResponse)
async def solve(body: ScheduleRequest) -> ScheduleResponse:
    """Run CSP/Backtracking solver to find up to 3 schedule options."""
    sections = [_schema_to_section(s) for s in body.sections]

    available_slots: set[tuple[int, int]] | None = None
    if body.available_slots:
        available_slots = {(slot.day, slot.period) for slot in body.available_slots}

    solutions, warnings = solve_schedule(
        body.course_codes, sections, available_slots,
    )

    return ScheduleResponse(
        solutions=[
            ScheduleSolution(
                sections=[
                    SolutionSectionSchema(
                        course_code=s.course_code,
                        section_code=s.section_code,
                        course_name=s.course_name,
                        day_of_week=s.day_of_week,
                        periods=s.periods,
                        room=s.room,
                        instructor_name=s.instructor_name,
                        is_lab=s.is_lab,
                    )
                    for s in sol.sections
                ]
            )
            for sol in solutions
        ],
        warnings=warnings,
    )


@router.post("/export-ics")
async def export_ics(
    body: IcsExportRequest,
    student: Annotated[Student, Depends(get_current_student)],
) -> Response:
    """Export a schedule as .ics file."""
    try:
        term_start = date.fromisoformat(body.term_start)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_term_start_date",
        )

    sections = [_schema_to_section(s) for s in body.sections]
    ics_bytes = generate_ics(
        student_id=str(student.id),
        sections=sections,
        term_start=term_start,
        term_weeks=body.term_weeks,
    )

    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=uit_tkb.ics"},
    )

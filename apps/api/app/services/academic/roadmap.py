"""Academic roadmap resolution – pure functions, no DB dependency.

Given a curriculum (courses per term), a student's enrollments, the
prerequisite graph, and elective group rules, produce a list of
``RoadmapNode`` objects representing the status of each course.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.services.academic.gpa import PASS_THRESHOLD, grade_10_to_4


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CourseInfo:
    course_id: int
    code: str
    name: str
    credits: int


@dataclass(frozen=True)
class CurriculumEntry:
    """One course placed in the curriculum grid."""
    course: CourseInfo
    term_number: int
    is_required: bool
    elective_group_id: int | None = None
    elective_group_name: str | None = None


@dataclass(frozen=True)
class EnrollmentInfo:
    """Minimal view of a student enrollment for roadmap resolution."""
    course_id: int
    final_grade_10: Decimal | None
    is_current_term: bool  # True if the enrollment is in the current term


@dataclass(frozen=True)
class PrerequisiteEdge:
    course_id: int
    prerequisite_course_id: int


@dataclass(frozen=True)
class ElectiveGroupRule:
    group_id: int
    group_name: str
    rule_type: str  # "credits" or "courses"
    required_value: int
    course_ids: list[int] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Output types
# ---------------------------------------------------------------------------

# Status constants
STATUS_PASSED = "passed"
STATUS_FAILED = "failed"
STATUS_IN_PROGRESS = "in_progress"
STATUS_LOCKED = "locked"
STATUS_NOT_STARTED = "not_started"


@dataclass(frozen=True)
class RoadmapNode:
    course_id: int
    course_code: str
    course_name: str
    credits: int
    term_number: int
    status: str
    grade_10: Decimal | None
    grade_4: Decimal | None
    prerequisites_met: bool
    missing_prerequisites: list[str]  # course codes
    elective_group_id: int | None
    elective_group_name: str | None
    is_required: bool


@dataclass(frozen=True)
class ElectiveGroupStatus:
    group_id: int
    group_name: str
    rule_type: str
    required_value: int
    current_value: int
    fulfilled: bool


# ---------------------------------------------------------------------------
# Resolution
# ---------------------------------------------------------------------------

def _build_passed_set(enrollments: list[EnrollmentInfo]) -> set[int]:
    """Course IDs where the student has passed."""
    return {
        e.course_id
        for e in enrollments
        if e.final_grade_10 is not None and e.final_grade_10 >= PASS_THRESHOLD
    }


def _enrollment_map(enrollments: list[EnrollmentInfo]) -> dict[int, EnrollmentInfo]:
    """Latest enrollment per course_id.

    If a student has multiple enrollments for the same course (retake),
    the most recent one (last in list) wins.
    """
    m: dict[int, EnrollmentInfo] = {}
    for e in enrollments:
        m[e.course_id] = e
    return m


def _prereqs_per_course(edges: list[PrerequisiteEdge]) -> dict[int, list[int]]:
    out: dict[int, list[int]] = {}
    for e in edges:
        out.setdefault(e.course_id, []).append(e.prerequisite_course_id)
    return out


def resolve_roadmap(
    curriculum: list[CurriculumEntry],
    enrollments: list[EnrollmentInfo],
    prerequisites: list[PrerequisiteEdge],
    course_code_map: dict[int, str] | None = None,
) -> list[RoadmapNode]:
    """Resolve the status of every course in the curriculum.

    ``course_code_map`` maps course_id → code for prerequisite display.
    If not supplied it is built from *curriculum*.
    """
    passed = _build_passed_set(enrollments)
    enroll_map = _enrollment_map(enrollments)
    prereq_map = _prereqs_per_course(prerequisites)

    if course_code_map is None:
        course_code_map = {c.course.course_id: c.course.code for c in curriculum}

    nodes: list[RoadmapNode] = []

    for entry in curriculum:
        cid = entry.course.course_id
        enrollment = enroll_map.get(cid)

        # Check prerequisites
        required_prereqs = prereq_map.get(cid, [])
        missing = [pid for pid in required_prereqs if pid not in passed]
        missing_codes = [course_code_map.get(pid, str(pid)) for pid in missing]
        prereqs_met = len(missing) == 0

        # Determine status
        if enrollment is not None:
            grade = enrollment.final_grade_10
            if grade is not None:
                if grade >= PASS_THRESHOLD:
                    status = STATUS_PASSED
                else:
                    status = STATUS_FAILED
            else:
                # Enrolled but no grade yet
                if enrollment.is_current_term:
                    status = STATUS_IN_PROGRESS
                else:
                    status = STATUS_NOT_STARTED
        elif not prereqs_met:
            status = STATUS_LOCKED
        else:
            status = STATUS_NOT_STARTED

        grade_10 = enrollment.final_grade_10 if enrollment else None
        grade_4 = grade_10_to_4(grade_10) if grade_10 is not None else None

        nodes.append(
            RoadmapNode(
                course_id=cid,
                course_code=entry.course.code,
                course_name=entry.course.name,
                credits=entry.course.credits,
                term_number=entry.term_number,
                status=status,
                grade_10=grade_10,
                grade_4=grade_4,
                prerequisites_met=prereqs_met,
                missing_prerequisites=missing_codes,
                elective_group_id=entry.elective_group_id,
                elective_group_name=entry.elective_group_name,
                is_required=entry.is_required,
            )
        )

    return nodes


def compute_elective_group_statuses(
    groups: list[ElectiveGroupRule],
    enrollments: list[EnrollmentInfo],
    credit_map: dict[int, int],
) -> list[ElectiveGroupStatus]:
    """Compute fulfillment status for each elective group.

    ``credit_map`` maps course_id → credits.
    """
    passed = _build_passed_set(enrollments)
    out: list[ElectiveGroupStatus] = []

    for g in groups:
        passed_in_group = [cid for cid in g.course_ids if cid in passed]
        if g.rule_type == "credits":
            current = sum(credit_map.get(cid, 0) for cid in passed_in_group)
        else:  # "courses"
            current = len(passed_in_group)

        out.append(
            ElectiveGroupStatus(
                group_id=g.group_id,
                group_name=g.group_name,
                rule_type=g.rule_type,
                required_value=g.required_value,
                current_value=current,
                fulfilled=current >= g.required_value,
            )
        )

    return out

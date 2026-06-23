"""Smart Recommendation and Schedule Solver – pure functions, no DB dependency.

Smart Recommendation scores courses following the PRD formula:
  +5 chuyên ngành, +2 sở trường, -3 khó+gpa_low, +2 đại cương, +3 elective_group
Tie-break: difficulty asc → credits asc → term_number asc

Schedule Solver uses backtracking with pruning to find up to 3
non-conflicting schedule options.  Timeout default: 7 seconds.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Sequence

from app.services.academic.excel_parser import Section
from app.services.academic.gpa import PASS_THRESHOLD
from app.services.academic.roadmap import ElectiveGroupRule, EnrollmentInfo


# ---------------------------------------------------------------------------
# Data types for recommendation
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class StudentContext:
    """Minimal student info for recommendation scoring."""
    cumulative_gpa_10: Decimal
    passed_course_ids: set[int]       # course IDs the student has passed
    enrolled_course_ids: set[int]     # currently enrolled (in-progress)
    grades: dict[int, Decimal]        # course_id → final_grade_10


@dataclass(frozen=True)
class CandidateCourse:
    """A course eligible for recommendation."""
    course_id: int
    course_code: str
    course_name: str
    credits: int
    kind: str               # "chuyên ngành", "đại cương", etc.
    difficulty: str | None   # "Khó", "Trung bình", "Dễ" or None
    term_number: int         # position in the model curriculum
    prerequisite_ids: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class ScoredCourse:
    """A recommended course with its score breakdown."""
    course_id: int
    course_code: str
    course_name: str
    credits: int
    score: int
    reasons: list[str]
    term_number: int
    difficulty: str | None


# Difficulty ordering for tie-break.
_DIFFICULTY_ORDER = {"Dễ": 0, "Trung bình": 1, None: 1, "Khó": 2}


def smart_recommend(
    candidates: list[CandidateCourse],
    student: StudentContext,
    elective_groups: list[ElectiveGroupRule],
    enrollments: list[EnrollmentInfo],
    credit_map: dict[int, int],
    available_course_codes: set[str] | None = None,
    *,
    top_n: int = 5,
) -> list[ScoredCourse]:
    """Score and rank candidate courses per the PRD formula.

    ``available_course_codes``: if provided, only courses whose code
    appears in this set (from the Excel TKB) are included.

    Returns the top *top_n* courses sorted by score desc, then
    tie-break by difficulty asc → credits asc → term_number asc.
    """
    # Pre-compute elective group fulfillment.
    passed_set = student.passed_course_ids
    unfulfilled_eg_course_ids: set[int] = set()
    for eg in elective_groups:
        passed_in_group = [cid for cid in eg.course_ids if cid in passed_set]
        if eg.rule_type == "credits":
            current = sum(credit_map.get(cid, 0) for cid in passed_in_group)
        else:
            current = len(passed_in_group)
        if current < eg.required_value:
            unfulfilled_eg_course_ids.update(eg.course_ids)

    # Pre-compute "sở trường" – courses that follow a course where
    # student scored >= 8.0.  We use prerequisite_ids to find the
    # "next" course: if a candidate has a prerequisite with grade >= 8.0,
    # it's a strength course.
    strength_prereq_ids: set[int] = set()
    for cid, grade in student.grades.items():
        if grade >= Decimal("8.0"):
            strength_prereq_ids.add(cid)

    results: list[ScoredCourse] = []
    all_done = student.passed_course_ids | student.enrolled_course_ids

    for c in candidates:
        # Skip already passed or currently enrolled.
        if c.course_id in all_done:
            continue

        # Skip if prerequisites not met.
        if any(pid not in passed_set for pid in c.prerequisite_ids):
            continue

        # Skip if not available in TKB (when filter provided).
        if available_course_codes is not None and c.course_code not in available_course_codes:
            continue

        score = 0
        reasons: list[str] = []

        # +5 chuyên ngành
        if c.kind == "chuyên ngành":
            score += 5
            reasons.append("+5 chuyên ngành")

        # +2 sở trường
        if any(pid in strength_prereq_ids for pid in c.prerequisite_ids):
            score += 2
            reasons.append("+2 sở trường (tiếp nối môn điểm cao)")

        # -3 khó AND gpa <= 6.0
        if c.difficulty == "Khó" and student.cumulative_gpa_10 <= Decimal("6.0"):
            score -= 3
            reasons.append("-3 môn khó, GPA thấp")

        # +2 đại cương chưa hoàn thành
        if c.kind == "đại cương":
            score += 2
            reasons.append("+2 đại cương chưa hoàn thành")

        # +3 elective group chưa thỏa
        if c.course_id in unfulfilled_eg_course_ids:
            score += 3
            reasons.append("+3 nhóm tự chọn chưa đủ")

        results.append(
            ScoredCourse(
                course_id=c.course_id,
                course_code=c.course_code,
                course_name=c.course_name,
                credits=c.credits,
                score=score,
                reasons=reasons,
                term_number=c.term_number,
                difficulty=c.difficulty,
            )
        )

    # Sort: score DESC, then tie-break difficulty ASC → credits ASC → term ASC
    results.sort(
        key=lambda sc: (
            -sc.score,
            _DIFFICULTY_ORDER.get(sc.difficulty, 1),
            sc.credits,
            sc.term_number,
        )
    )

    return results[:top_n]


# ---------------------------------------------------------------------------
# Schedule solver (CSP / Backtracking)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TimeSlot:
    """One occupied timeslot: a (day, period) pair."""
    day: int     # 2..7
    period: int  # 1..13


def _section_slots(section: Section) -> list[TimeSlot]:
    """Extract all TimeSlots occupied by a section."""
    return [TimeSlot(day=section.day_of_week, period=p) for p in section.periods]


def _has_conflict(schedule: list[Section], candidate: Section) -> bool:
    """Check if *candidate* conflicts with any section in *schedule*."""
    cand_slots = set((candidate.day_of_week, p) for p in candidate.periods)
    for s in schedule:
        for p in s.periods:
            if (s.day_of_week, p) in cand_slots:
                return True
    return False


def _sections_conflict(a: Section, b: Section) -> bool:
    """Check if two sections overlap in time."""
    if a.day_of_week != b.day_of_week:
        return False
    return bool(set(a.periods) & set(b.periods))


@dataclass
class ScheduleSolution:
    """One valid schedule assignment."""
    sections: list[Section]
    conflict_free: bool = True


def solve_schedule(
    course_codes: list[str],
    all_sections: list[Section],
    available_slots: set[tuple[int, int]] | None = None,
    *,
    max_solutions: int = 3,
    timeout_seconds: float = 7.0,
) -> tuple[list[ScheduleSolution], list[str]]:
    """Find up to *max_solutions* non-conflicting schedules.

    Parameters
    ----------
    course_codes : list[str]
        The courses to schedule (by course_code).
    all_sections : list[Section]
        All available sections from the TKB.
    available_slots : set of (day, period) or None
        If provided, only sections fitting within these slots are considered.
        ``None`` means all slots are available.
    max_solutions : int
        Maximum number of solutions to return.
    timeout_seconds : float
        Hard timeout for the solver.

    Returns
    -------
    (solutions, warnings) where warnings lists courses that could not
    be scheduled in any solution (e.g., no sections available, or always
    conflicting).
    """
    # Group sections by course_code.
    sections_by_course: dict[str, list[Section]] = {}
    for s in all_sections:
        if s.course_code in course_codes:
            # Filter by available slots if provided.
            if available_slots is not None:
                if any((s.day_of_week, p) not in available_slots for p in s.periods):
                    continue
            sections_by_course.setdefault(s.course_code, []).append(s)

    # Some courses may also have lab sections (is_lab=True) that need
    # to be scheduled alongside their theory section.  Group them:
    # For each course, we need to pick compatible section sets.
    # Simplification: treat each section_code as an independent option.
    # A section_code like "CE118.Q11" (LT) may have paired lab sections
    # "CE118.Q11.1", "CE118.Q11.2".  We group by the base (before last dot
    # if is_lab) and require both theory + lab to be picked together.

    @dataclass
    class CourseOption:
        """A set of sections that must be chosen together (theory + lab)."""
        sections: list[Section]

    course_options: dict[str, list[CourseOption]] = {}
    warnings: list[str] = []

    for cc in course_codes:
        sects = sections_by_course.get(cc, [])
        if not sects:
            warnings.append(f"Không tìm thấy lớp mở cho {cc}")
            continue

        # Separate theory and lab sections.
        theory: dict[str, Section] = {}
        labs: dict[str, list[Section]] = {}

        for s in sects:
            if s.is_lab or s.teaching_type in ("HT1", "HT2"):
                # Lab section: base is section_code without the last ".N" suffix.
                # e.g. "CE118.Q11.1" → base "CE118.Q11"
                parts = s.section_code.rsplit(".", 1)
                base = parts[0] if len(parts) > 1 and parts[1].isdigit() else s.section_code
                labs.setdefault(base, []).append(s)
            else:
                theory[s.section_code] = s

        options: list[CourseOption] = []
        if theory:
            for sc, ts in theory.items():
                # Find matching lab sections for this theory section.
                matching_labs = labs.get(sc, [])
                if matching_labs:
                    # Each lab is an independent option paired with this theory.
                    for lab in matching_labs:
                        options.append(CourseOption(sections=[ts, lab]))
                else:
                    options.append(CourseOption(sections=[ts]))
        elif labs:
            # Only lab sections (no theory) – unusual but handle it.
            for lab_list in labs.values():
                for lab in lab_list:
                    options.append(CourseOption(sections=[lab]))

        if options:
            course_options[cc] = options
        else:
            warnings.append(f"Không tìm thấy lớp phù hợp cho {cc}")

    # Backtracking solver.
    ordered_courses = list(course_options.keys())
    solutions: list[ScheduleSolution] = []
    deadline = time.monotonic() + timeout_seconds

    def _occupied(schedule: list[Section]) -> set[tuple[int, int]]:
        occ: set[tuple[int, int]] = set()
        for s in schedule:
            for p in s.periods:
                occ.add((s.day_of_week, p))
        return occ

    def _option_conflicts(occupied: set[tuple[int, int]], option: CourseOption) -> bool:
        for s in option.sections:
            for p in s.periods:
                if (s.day_of_week, p) in occupied:
                    return True
        return False

    def backtrack(idx: int, current: list[Section], occupied: set[tuple[int, int]]) -> None:
        if len(solutions) >= max_solutions:
            return
        if time.monotonic() > deadline:
            return

        if idx == len(ordered_courses):
            solutions.append(ScheduleSolution(sections=list(current)))
            return

        cc = ordered_courses[idx]
        for option in course_options[cc]:
            if _option_conflicts(occupied, option):
                continue
            # Choose this option.
            new_occ = set(occupied)
            for s in option.sections:
                for p in s.periods:
                    new_occ.add((s.day_of_week, p))
            backtrack(idx + 1, current + option.sections, new_occ)

    backtrack(0, [], set())

    # If some courses had no options and thus weren't in the solver,
    # the solutions are partial. Mark that in warnings already done above.

    return solutions, warnings

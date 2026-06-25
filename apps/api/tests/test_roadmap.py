"""Unit tests for Academic Roadmap resolution logic."""

from __future__ import annotations

from decimal import Decimal

from app.services.academic.roadmap import (
    STATUS_FAILED,
    STATUS_IN_PROGRESS,
    STATUS_LOCKED,
    STATUS_NOT_STARTED,
    STATUS_PASSED,
    CourseInfo,
    CurriculumEntry,
    ElectiveGroupRule,
    EnrollmentInfo,
    PrerequisiteEdge,
    compute_elective_group_statuses,
    resolve_roadmap,
)


def _course(cid: int, code: str = "", name: str = "", credits: int = 3) -> CourseInfo:
    return CourseInfo(
        course_id=cid, code=code or f"CS{cid}", name=name or f"Course {cid}", credits=credits
    )


def _entry(
    cid: int,
    term: int = 1,
    *,
    is_required: bool = True,
    eg_id: int | None = None,
    eg_name: str | None = None,
) -> CurriculumEntry:
    return CurriculumEntry(
        course=_course(cid),
        term_number=term,
        is_required=is_required,
        elective_group_id=eg_id,
        elective_group_name=eg_name,
    )


# ---------------------------------------------------------------------------
# Roadmap resolution
# ---------------------------------------------------------------------------


class TestResolveRoadmap:
    def test_all_not_started_preview_mode(self) -> None:
        """No enrollments → all courses are not_started (preview mode)."""
        curriculum = [_entry(1, 1), _entry(2, 2)]
        nodes = resolve_roadmap(curriculum, [], [])
        assert len(nodes) == 2
        assert all(n.status == STATUS_NOT_STARTED for n in nodes)

    def test_passed(self) -> None:
        """A course with grade >= 4.0 is passed."""
        curriculum = [_entry(1)]
        enrollments = [
            EnrollmentInfo(course_id=1, final_grade_10=Decimal("7.5"), is_current_term=False)
        ]
        nodes = resolve_roadmap(curriculum, enrollments, [])
        assert nodes[0].status == STATUS_PASSED
        assert nodes[0].grade_10 == Decimal("7.5")

    def test_failed(self) -> None:
        """A course with grade < 4.0 is failed."""
        curriculum = [_entry(1)]
        enrollments = [
            EnrollmentInfo(course_id=1, final_grade_10=Decimal("3.5"), is_current_term=False)
        ]
        nodes = resolve_roadmap(curriculum, enrollments, [])
        assert nodes[0].status == STATUS_FAILED

    def test_in_progress(self) -> None:
        """Enrolled in current term with no grade → in_progress."""
        curriculum = [_entry(1)]
        enrollments = [EnrollmentInfo(course_id=1, final_grade_10=None, is_current_term=True)]
        nodes = resolve_roadmap(curriculum, enrollments, [])
        assert nodes[0].status == STATUS_IN_PROGRESS

    def test_locked_by_prerequisite(self) -> None:
        """Not enrolled + prerequisite not met → locked."""
        curriculum = [_entry(1, 1), _entry(2, 2)]
        prerequisites = [PrerequisiteEdge(course_id=2, prerequisite_course_id=1)]
        nodes = resolve_roadmap(curriculum, [], prerequisites)
        assert nodes[0].status == STATUS_NOT_STARTED  # CS1 has no prereqs
        assert nodes[1].status == STATUS_LOCKED
        assert nodes[1].missing_prerequisites == ["CS1"]

    def test_unlocked_when_prerequisite_passed(self) -> None:
        """Prerequisite passed → course is not_started (not locked)."""
        curriculum = [_entry(1, 1), _entry(2, 2)]
        prerequisites = [PrerequisiteEdge(course_id=2, prerequisite_course_id=1)]
        enrollments = [
            EnrollmentInfo(course_id=1, final_grade_10=Decimal("5.0"), is_current_term=False)
        ]
        nodes = resolve_roadmap(curriculum, enrollments, prerequisites)
        assert nodes[0].status == STATUS_PASSED
        assert nodes[1].status == STATUS_NOT_STARTED
        assert nodes[1].prerequisites_met is True
        assert nodes[1].missing_prerequisites == []

    def test_locked_prerequisite_failed(self) -> None:
        """Prerequisite failed → dependent course is still locked."""
        curriculum = [_entry(1, 1), _entry(2, 2)]
        prerequisites = [PrerequisiteEdge(course_id=2, prerequisite_course_id=1)]
        enrollments = [
            EnrollmentInfo(course_id=1, final_grade_10=Decimal("3.0"), is_current_term=False)
        ]
        nodes = resolve_roadmap(curriculum, enrollments, prerequisites)
        assert nodes[0].status == STATUS_FAILED
        assert nodes[1].status == STATUS_LOCKED

    def test_multiple_prerequisites(self) -> None:
        """Course with two prerequisites, one passed one not → locked with the missing one listed."""
        curriculum = [_entry(1, 1), _entry(2, 1), _entry(3, 2)]
        prerequisites = [
            PrerequisiteEdge(course_id=3, prerequisite_course_id=1),
            PrerequisiteEdge(course_id=3, prerequisite_course_id=2),
        ]
        enrollments = [
            EnrollmentInfo(course_id=1, final_grade_10=Decimal("6.0"), is_current_term=False)
        ]
        nodes = resolve_roadmap(curriculum, enrollments, prerequisites)
        course_3_node = nodes[2]
        assert course_3_node.status == STATUS_LOCKED
        assert "CS2" in course_3_node.missing_prerequisites
        assert "CS1" not in course_3_node.missing_prerequisites


# ---------------------------------------------------------------------------
# Elective group statuses
# ---------------------------------------------------------------------------


class TestElectiveGroupStatus:
    def test_credits_rule_partial(self) -> None:
        """Partially fulfilled credits-based elective group."""
        groups = [
            ElectiveGroupRule(
                group_id=1,
                group_name="Tự chọn CN",
                rule_type="credits",
                required_value=9,
                course_ids=[10, 11, 12],
            )
        ]
        enrollments = [
            EnrollmentInfo(course_id=10, final_grade_10=Decimal("7.0"), is_current_term=False),
        ]
        credit_map = {10: 3, 11: 3, 12: 3}
        statuses = compute_elective_group_statuses(groups, enrollments, credit_map)
        assert len(statuses) == 1
        assert statuses[0].current_value == 3
        assert statuses[0].fulfilled is False

    def test_credits_rule_fulfilled(self) -> None:
        groups = [
            ElectiveGroupRule(
                group_id=1,
                group_name="Tự chọn CN",
                rule_type="credits",
                required_value=6,
                course_ids=[10, 11, 12],
            )
        ]
        enrollments = [
            EnrollmentInfo(course_id=10, final_grade_10=Decimal("7.0"), is_current_term=False),
            EnrollmentInfo(course_id=11, final_grade_10=Decimal("6.0"), is_current_term=False),
        ]
        credit_map = {10: 3, 11: 3, 12: 3}
        statuses = compute_elective_group_statuses(groups, enrollments, credit_map)
        assert statuses[0].current_value == 6
        assert statuses[0].fulfilled is True

    def test_courses_rule(self) -> None:
        """Courses-count rule: need at least 2 courses, passed 1."""
        groups = [
            ElectiveGroupRule(
                group_id=2,
                group_name="Tự chọn ĐC",
                rule_type="courses",
                required_value=2,
                course_ids=[20, 21, 22],
            )
        ]
        enrollments = [
            EnrollmentInfo(course_id=20, final_grade_10=Decimal("5.0"), is_current_term=False),
        ]
        credit_map = {20: 3, 21: 3, 22: 3}
        statuses = compute_elective_group_statuses(groups, enrollments, credit_map)
        assert statuses[0].current_value == 1
        assert statuses[0].fulfilled is False

    def test_failed_course_not_counted(self) -> None:
        """Failed courses don't count toward group fulfillment."""
        groups = [
            ElectiveGroupRule(
                group_id=1,
                group_name="Tự chọn",
                rule_type="credits",
                required_value=3,
                course_ids=[10, 11],
            )
        ]
        enrollments = [
            EnrollmentInfo(
                course_id=10, final_grade_10=Decimal("3.0"), is_current_term=False
            ),  # failed
        ]
        credit_map = {10: 3, 11: 3}
        statuses = compute_elective_group_statuses(groups, enrollments, credit_map)
        assert statuses[0].current_value == 0
        assert statuses[0].fulfilled is False

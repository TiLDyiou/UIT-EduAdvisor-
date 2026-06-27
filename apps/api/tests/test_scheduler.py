"""Unit tests for Milestone 5 – UIT Scheduler.

Tests cover:
- Excel TKB period parsing
- Smart Recommendation scoring
- CSP/Backtracking schedule solver
- ICS export stable UID
"""

from __future__ import annotations

import time
from datetime import date
from decimal import Decimal

from app.services.academic.excel_parser import Section, parse_periods
from app.services.academic.ics_export import generate_ics, stable_uid
from app.services.academic.roadmap import ElectiveGroupRule
from app.services.academic.scheduler import (
    CandidateCourse,
    StudentContext,
    smart_recommend,
    solve_schedule,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _section(
    code: str = "CS101",
    section_code: str = "CS101.Q11",
    name: str = "Course 101",
    day: int = 2,
    periods: list[int] | None = None,
    credits: int = 3,
    is_lab: bool = False,
    teaching_type: str = "LT",
    biweekly: bool = False,
    room: str = "B1.16",
) -> Section:
    return Section(
        course_code=code,
        section_code=section_code,
        course_name=name,
        credits=credits,
        is_lab=is_lab,
        teaching_type=teaching_type,
        day_of_week=day,
        periods=periods or [1, 2, 3],
        biweekly=biweekly,
        room=room,
    )


def _student(
    gpa_10: Decimal = Decimal("7.0"),
    passed: set[int] | None = None,
    enrolled: set[int] | None = None,
    grades: dict[int, Decimal] | None = None,
) -> StudentContext:
    return StudentContext(
        cumulative_gpa_10=gpa_10,
        passed_course_ids=passed or set(),
        enrolled_course_ids=enrolled or set(),
        grades=grades or {},
    )


def _candidate(
    cid: int = 1,
    code: str = "CS101",
    name: str = "Course 101",
    credits: int = 3,
    kind: str = "chuyên ngành",
    difficulty: str | None = None,
    term: int = 1,
    prereqs: list[int] | None = None,
) -> CandidateCourse:
    return CandidateCourse(
        course_id=cid,
        course_code=code,
        course_name=name,
        credits=credits,
        kind=kind,
        difficulty=difficulty,
        term_number=term,
        prerequisite_ids=prereqs or [],
    )


# ---------------------------------------------------------------------------
# Period parsing
# ---------------------------------------------------------------------------


class TestParsePeriods:
    def test_concatenated_digits(self) -> None:
        assert parse_periods("123") == [1, 2, 3]
        assert parse_periods("6789") == [6, 7, 8, 9]

    def test_zero_means_10(self) -> None:
        assert parse_periods("90") == [9, 10]
        assert parse_periods("67890") == [6, 7, 8, 9, 10]

    def test_comma_separated(self) -> None:
        assert parse_periods("11,12,13") == [11, 12, 13]

    def test_star_returns_empty(self) -> None:
        assert parse_periods("*") == []

    def test_none_returns_empty(self) -> None:
        assert parse_periods(None) == []

    def test_integer_input(self) -> None:
        assert parse_periods(123) == [1, 2, 3]

    def test_single_digit(self) -> None:
        assert parse_periods("5") == [5]

    def test_sorted_output(self) -> None:
        assert parse_periods("321") == [1, 2, 3]


# ---------------------------------------------------------------------------
# Smart Recommendation scoring
# ---------------------------------------------------------------------------


class TestSmartRecommend:
    def test_chuyen_nganh_plus_5(self) -> None:
        """Chuyên ngành course gets +5."""
        candidates = [_candidate(kind="chuyên ngành")]
        result = smart_recommend(candidates, _student(), [], [], {})
        assert result[0].score == 5
        assert "+5 chuyên ngành" in result[0].reasons

    def test_dai_cuong_plus_2(self) -> None:
        """Đại cương course gets +2."""
        candidates = [_candidate(kind="đại cương")]
        result = smart_recommend(candidates, _student(), [], [], {})
        assert result[0].score == 2
        assert "+2 đại cương chưa hoàn thành" in result[0].reasons

    def test_so_truong_plus_2(self) -> None:
        """Course following a high-grade prerequisite gets +2."""
        candidates = [_candidate(cid=2, prereqs=[1])]
        student = _student(passed={1}, grades={1: Decimal("8.5")})
        result = smart_recommend(candidates, student, [], [], {})
        assert any("+2 sở trường" in r for r in result[0].reasons)

    def test_hard_course_low_gpa_minus_3(self) -> None:
        """Khó course with GPA <= 6.0 gets -3."""
        candidates = [_candidate(kind="đại cương", difficulty="Khó")]
        student = _student(gpa_10=Decimal("5.0"))
        result = smart_recommend(candidates, student, [], [], {})
        # +2 đại cương - 3 khó = -1
        assert result[0].score == -1
        assert "-3 môn khó, GPA thấp" in result[0].reasons

    def test_hard_course_ok_gpa_no_penalty(self) -> None:
        """Khó course with GPA > 6.0 gets no penalty."""
        candidates = [_candidate(kind="chuyên ngành", difficulty="Khó")]
        student = _student(gpa_10=Decimal("7.0"))
        result = smart_recommend(candidates, student, [], [], {})
        assert result[0].score == 5  # only +5 chuyên ngành
        assert "-3 môn khó" not in " ".join(result[0].reasons)

    def test_elective_group_plus_3(self) -> None:
        """Course in unfulfilled elective group gets +3."""
        candidates = [_candidate(cid=10, kind="tự chọn")]
        eg_rules = [
            ElectiveGroupRule(
                group_id=1,
                group_name="Tự chọn CN",
                rule_type="credits",
                required_value=9,
                course_ids=[10, 11, 12],
            )
        ]
        result = smart_recommend(candidates, _student(), eg_rules, [], {10: 3, 11: 3, 12: 3})
        assert result[0].score == 3
        assert "+3 nhóm tự chọn chưa đủ" in result[0].reasons

    def test_skip_passed_courses(self) -> None:
        """Passed courses are excluded."""
        candidates = [_candidate(cid=1)]
        student = _student(passed={1})
        result = smart_recommend(candidates, student, [], [], {})
        assert len(result) == 0

    def test_skip_unmet_prerequisites(self) -> None:
        """Courses with unmet prerequisites are excluded."""
        candidates = [_candidate(cid=2, prereqs=[1])]
        result = smart_recommend(candidates, _student(), [], [], {})
        assert len(result) == 0

    def test_tie_break_difficulty_credits_term(self) -> None:
        """Same score → sort by difficulty asc, credits asc, term asc."""
        candidates = [
            _candidate(cid=1, kind="đại cương", difficulty="Khó", credits=4, term=3),
            _candidate(cid=2, kind="đại cương", difficulty="Dễ", credits=3, term=1),
            _candidate(cid=3, kind="đại cương", difficulty="Trung bình", credits=3, term=2),
        ]
        student = _student(gpa_10=Decimal("7.5"))  # high enough to avoid -3 penalty
        result = smart_recommend(candidates, student, [], [], {}, top_n=10)
        # All score +2 (đại cương), no penalty since gpa > 2.5
        # Tie-break: Dễ(0,3,1) < TB(1,3,2) < Khó(2,4,3)
        assert [r.course_id for r in result] == [2, 3, 1]

    def test_cumulative_scoring(self) -> None:
        """Scores are cumulative (chuyên ngành + elective = 5+3=8)."""
        candidates = [_candidate(cid=10, kind="chuyên ngành")]
        eg_rules = [
            ElectiveGroupRule(
                group_id=1,
                group_name="EG1",
                rule_type="courses",
                required_value=2,
                course_ids=[10, 11],
            )
        ]
        result = smart_recommend(candidates, _student(), eg_rules, [], {10: 3, 11: 3})
        assert result[0].score == 8  # 5 + 3

    def test_available_filter(self) -> None:
        """Only courses in available_course_codes set are returned."""
        candidates = [
            _candidate(cid=1, code="CS101", kind="đại cương"),
            _candidate(cid=2, code="CS102", kind="đại cương"),
        ]
        result = smart_recommend(
            candidates,
            _student(),
            [],
            [],
            {},
            available_course_codes={"CS101"},
            top_n=10,
        )
        assert len(result) == 1
        assert result[0].course_code == "CS101"

    def test_top_n_limit(self) -> None:
        """Returns at most top_n results."""
        candidates = [_candidate(cid=i, code=f"CS{i}", kind="đại cương") for i in range(10)]
        result = smart_recommend(candidates, _student(), [], [], {}, top_n=5)
        assert len(result) == 5


# ---------------------------------------------------------------------------
# Schedule Solver
# ---------------------------------------------------------------------------


class TestSolveSchedule:
    def test_single_course_single_section(self) -> None:
        """One course with one section → one solution."""
        sections = [_section(code="CS101")]
        solutions, warnings = solve_schedule(["CS101"], sections)
        assert len(solutions) == 1
        assert len(solutions[0].sections) == 1
        assert solutions[0].sections[0].course_code == "CS101"

    def test_no_conflict_two_courses(self) -> None:
        """Two courses on different days → one solution with both."""
        sections = [
            _section(code="CS101", section_code="CS101.Q11", day=2, periods=[1, 2, 3]),
            _section(code="CS102", section_code="CS102.Q11", day=3, periods=[1, 2, 3]),
        ]
        solutions, warnings = solve_schedule(["CS101", "CS102"], sections)
        assert len(solutions) >= 1
        assert len(solutions[0].sections) == 2

    def test_conflict_detection(self) -> None:
        """Two courses on same day+periods → relaxed solver drops 1 course."""
        sections = [
            _section(code="CS101", section_code="CS101.Q11", day=2, periods=[1, 2, 3]),
            _section(code="CS102", section_code="CS102.Q11", day=2, periods=[2, 3, 4]),
        ]
        solutions, warnings = solve_schedule(["CS101", "CS102"], sections)
        assert len(solutions) == 2
        assert len(solutions[0].missing_courses) == 1
        assert "vì trùng lịch với môn" in solutions[0].missing_courses[0]

    def test_max_solutions(self) -> None:
        """Solver returns at most max_solutions."""
        sections = [
            _section(code="CS101", section_code=f"CS101.Q{i}", day=d, periods=[1, 2])
            for i, d in enumerate([2, 3, 4, 5, 6], start=1)
        ]
        solutions, warnings = solve_schedule(["CS101"], sections, max_solutions=3)
        assert len(solutions) <= 3
        solutions_default, warnings = solve_schedule(["CS101"], sections)
        assert len(solutions_default) <= 7

    def test_missing_course_warning(self) -> None:
        """Course with no sections generates a warning."""
        solutions, warnings = solve_schedule(["CS999"], [])
        assert any("CS999" in w for w in warnings)
        # The solver may return a trivially empty solution (0 courses to
        # schedule), so we check warnings rather than solution count.

    def test_available_slots_filter(self) -> None:
        """Sections outside available_slots are excluded."""
        sections = [
            _section(code="CS101", section_code="CS101.Q11", day=2, periods=[1, 2]),
            _section(code="CS101", section_code="CS101.Q12", day=3, periods=[6, 7]),
        ]
        # Only afternoon on Wednesday is available.
        available = {(3, 6), (3, 7)}
        solutions, warnings = solve_schedule(["CS101"], sections, available)
        assert len(solutions) == 1
        assert solutions[0].sections[0].section_code == "CS101.Q12"

    def test_available_slots_filter_with_sunday(self) -> None:
        """Sections on Sunday are filterable using day=8 available slot constraint."""
        sections = [
            _section(code="CS101", section_code="CS101.Q11", day=8, periods=[1, 2]),
            _section(code="CS101", section_code="CS101.Q12", day=3, periods=[6, 7]),
        ]
        # Only Sunday morning is available.
        available = {(8, 1), (8, 2)}
        solutions, warnings = solve_schedule(["CS101"], sections, available)
        assert len(solutions) == 1
        assert solutions[0].sections[0].section_code == "CS101.Q11"

    def test_theory_plus_lab_pairing(self) -> None:
        """Theory + lab sections of same group are picked together."""
        sections = [
            _section(code="CE118", section_code="CE118.Q11", day=2, periods=[1, 2, 3]),
            _section(
                code="CE118",
                section_code="CE118.Q11.1",
                day=3,
                periods=[6, 7, 8],
                is_lab=True,
                teaching_type="HT1",
            ),
        ]
        solutions, warnings = solve_schedule(["CE118"], sections)
        assert len(solutions) == 1
        assert len(solutions[0].sections) == 2  # theory + lab

    def test_theory_plus_lab_suffix_pairing(self) -> None:
        """Theory (CE118) + lab sections with suffix (CE118.1) are paired and picked together."""
        sections = [
            _section(code="CE118", section_code="CE118.Q11", day=2, periods=[1, 2, 3]),
            _section(
                code="CE118.1",
                section_code="CE118.Q11.1",
                day=3,
                periods=[6, 7, 8],
                is_lab=True,
                teaching_type="HT1",
            ),
        ]
        solutions, warnings = solve_schedule(["CE118"], sections)
        assert len(solutions) == 1
        assert len(solutions[0].sections) == 2  # theory + lab

    def test_multiple_courses_with_choices(self) -> None:
        """Two courses each with 2 sections → finds valid combinations."""
        sections = [
            _section(code="A", section_code="A.Q1", day=2, periods=[1, 2]),
            _section(code="A", section_code="A.Q2", day=3, periods=[1, 2]),
            _section(code="B", section_code="B.Q1", day=2, periods=[3, 4]),
            _section(code="B", section_code="B.Q2", day=3, periods=[3, 4]),
        ]
        solutions, warnings = solve_schedule(["A", "B"], sections)
        # At least (A.Q1+B.Q1), (A.Q1+B.Q2), (A.Q2+B.Q1) should work
        assert len(solutions) >= 1
        for sol in solutions:
            # Check no conflicts
            occupied: set[tuple[int, int]] = set()
            for s in sol.sections:
                for p in s.periods:
                    key = (s.day_of_week, p)
                    assert key not in occupied, f"Conflict at {key}"
                    occupied.add(key)


class TestSolveSchedulePerformance:
    def test_1000_combinations_under_7_seconds(self) -> None:
        """Performance test: ~1000 combinations should resolve < 7s."""
        # 5 courses × ~10 sections each = ~100k theoretical combos
        # but with conflict pruning, should be fast.
        sections: list[Section] = []
        for course_idx in range(5):
            code = f"C{course_idx}"
            for sec_idx in range(10):
                day = (sec_idx % 6) + 2  # 2-7
                start = (sec_idx % 5) * 2 + 1  # 1,3,5,7,9
                sections.append(
                    _section(
                        code=code,
                        section_code=f"{code}.Q{sec_idx}",
                        day=day,
                        periods=[start, start + 1],
                    )
                )

        start_time = time.monotonic()
        solutions, _ = solve_schedule(
            [f"C{i}" for i in range(5)],
            sections,
            timeout_seconds=7.0,
        )
        elapsed = time.monotonic() - start_time

        assert elapsed < 7.0, f"Solver took {elapsed:.2f}s, exceeding 7s limit"
        assert len(solutions) >= 1


# ---------------------------------------------------------------------------
# ICS Export
# ---------------------------------------------------------------------------


class TestStableUid:
    def test_deterministic(self) -> None:
        """Same inputs → same UID."""
        uid1 = stable_uid("stu1", "CS101", date(2025, 9, 8))
        uid2 = stable_uid("stu1", "CS101", date(2025, 9, 8))
        assert uid1 == uid2

    def test_different_student(self) -> None:
        """Different student_id → different UID."""
        uid1 = stable_uid("stu1", "CS101", date(2025, 9, 8))
        uid2 = stable_uid("stu2", "CS101", date(2025, 9, 8))
        assert uid1 != uid2

    def test_different_week(self) -> None:
        """Different week_start → different UID."""
        uid1 = stable_uid("stu1", "CS101", date(2025, 9, 8))
        uid2 = stable_uid("stu1", "CS101", date(2025, 9, 15))
        assert uid1 != uid2

    def test_format(self) -> None:
        """UID ends with @uit-eduadvisor."""
        uid = stable_uid("stu1", "CS101", date(2025, 9, 8))
        assert uid.endswith("@uit-eduadvisor")


class TestGenerateIcs:
    def test_basic_output(self) -> None:
        """ICS output is valid bytes starting with VCALENDAR."""
        sections = [_section(code="CS101", day=2, periods=[1, 2, 3])]
        ics = generate_ics("student-1", sections, date(2025, 9, 8), term_weeks=2)
        text = ics.decode("utf-8")
        assert "BEGIN:VCALENDAR" in text
        assert "BEGIN:VEVENT" in text
        assert "CS101" in text
        assert "END:VCALENDAR" in text

    def test_stable_uid_in_events(self) -> None:
        """Events in ICS have @uit-eduadvisor UIDs."""
        sections = [_section(code="CS101", day=2, periods=[1, 2])]
        ics = generate_ics("student-1", sections, date(2025, 9, 8), term_weeks=1)
        # ICS line-folds long lines, so unfold before searching.
        text = ics.decode("utf-8").replace("\r\n ", "")
        assert "@uit-eduadvisor" in text

    def test_biweekly_fewer_events(self) -> None:
        """Biweekly sections generate half the events of weekly ones."""
        weekly = [_section(code="A", day=2, periods=[1], biweekly=False)]
        biweekly = [_section(code="B", day=3, periods=[1], biweekly=True)]

        ics_w = generate_ics("s1", weekly, date(2025, 9, 8), term_weeks=4)
        ics_b = generate_ics("s1", biweekly, date(2025, 9, 8), term_weeks=4)

        count_w = ics_w.decode().count("BEGIN:VEVENT")
        count_b = ics_b.decode().count("BEGIN:VEVENT")
        assert count_w == 4
        assert count_b == 2

    def test_reimport_no_duplicate(self) -> None:
        """Re-generating ICS produces identical UIDs → no duplicate on re-import."""
        sections = [_section(code="CS101", day=2, periods=[1, 2])]
        ics1 = generate_ics("s1", sections, date(2025, 9, 8), term_weeks=2)
        ics2 = generate_ics("s1", sections, date(2025, 9, 8), term_weeks=2)

        # Extract UIDs.
        import re

        uids1 = set(re.findall(r"UID:(.+)", ics1.decode()))
        uids2 = set(re.findall(r"UID:(.+)", ics2.decode()))
        assert uids1 == uids2

"""Unit tests for GPA calculation logic."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.academic.gpa import (
    EnrollmentRow,
    compute_cumulative_gpa,
    grade_10_to_4,
    grade_10_to_letter,
    is_passed,
    retake_estimate,
    reverse_calculate,
    simulate_gpa,
)


# ---------------------------------------------------------------------------
# Scale conversion
# ---------------------------------------------------------------------------


class TestGrade10To4:
    @pytest.mark.parametrize(
        ("score", "expected"),
        [
            (Decimal("10"), Decimal("4.0")),
            (Decimal("9.5"), Decimal("4.0")),
            (Decimal("8.5"), Decimal("4.0")),
            (Decimal("8.4"), Decimal("3.0")),
            (Decimal("7.0"), Decimal("3.0")),
            (Decimal("6.9"), Decimal("2.0")),
            (Decimal("5.5"), Decimal("2.0")),
            (Decimal("5.4"), Decimal("1.0")),
            (Decimal("4.0"), Decimal("1.0")),
            (Decimal("3.9"), Decimal("0.0")),
            (Decimal("0"), Decimal("0.0")),
        ],
    )
    def test_boundaries(self, score: Decimal, expected: Decimal) -> None:
        assert grade_10_to_4(score) == expected


class TestGrade10ToLetter:
    @pytest.mark.parametrize(
        ("score", "expected"),
        [
            (Decimal("10"), "A"),
            (Decimal("8.5"), "A"),
            (Decimal("8.4"), "B"),
            (Decimal("7.0"), "B"),
            (Decimal("6.9"), "C"),
            (Decimal("5.5"), "C"),
            (Decimal("5.4"), "D"),
            (Decimal("4.0"), "D"),
            (Decimal("3.9"), "F"),
            (Decimal("0"), "F"),
        ],
    )
    def test_boundaries(self, score: Decimal, expected: str) -> None:
        assert grade_10_to_letter(score) == expected


class TestIsPassed:
    def test_passed(self) -> None:
        assert is_passed(Decimal("4.0")) is True
        assert is_passed(Decimal("10")) is True

    def test_failed(self) -> None:
        assert is_passed(Decimal("3.9")) is False
        assert is_passed(Decimal("0")) is False

    def test_none(self) -> None:
        assert is_passed(None) is False


# ---------------------------------------------------------------------------
# Cumulative GPA
# ---------------------------------------------------------------------------


class TestComputeCumulativeGpa:
    def test_basic(self) -> None:
        rows = [
            EnrollmentRow(credits=3, final_grade_10=Decimal("8.0")),  # B → 3.0
            EnrollmentRow(credits=4, final_grade_10=Decimal("6.0")),  # C → 2.0
            EnrollmentRow(credits=3, final_grade_10=Decimal("9.0")),  # A → 4.0
        ]
        result = compute_cumulative_gpa(rows)
        # Weighted sum 10: 3*8 + 4*6 + 3*9 = 24+24+27 = 75
        # Total credits: 10
        # GPA 10: 75/10 = 7.50
        assert result.gpa_10 == Decimal("7.50")
        assert result.total_credits == 10
        assert result.earned_credits == 10  # all >= 4.0

        # Weighted sum 4: 3*3.0 + 4*2.0 + 3*4.0 = 9+8+12 = 29
        # GPA 4: 29/10 = 2.90
        assert result.gpa_4 == Decimal("2.90")

    def test_empty(self) -> None:
        result = compute_cumulative_gpa([])
        assert result.gpa_10 == Decimal("0")
        assert result.gpa_4 == Decimal("0")
        assert result.total_credits == 0
        assert result.earned_credits == 0

    def test_skip_none_grades(self) -> None:
        rows = [
            EnrollmentRow(credits=3, final_grade_10=Decimal("8.0")),
            EnrollmentRow(credits=4, final_grade_10=None),  # in progress
        ]
        result = compute_cumulative_gpa(rows)
        assert result.gpa_10 == Decimal("8.00")
        assert result.total_credits == 3  # only the graded one counts

    def test_with_failed(self) -> None:
        rows = [
            EnrollmentRow(credits=3, final_grade_10=Decimal("8.0")),  # passed
            EnrollmentRow(credits=3, final_grade_10=Decimal("3.0")),  # failed
        ]
        result = compute_cumulative_gpa(rows)
        assert result.total_credits == 6
        assert result.earned_credits == 3  # only one passed
        # GPA 10: (24 + 9) / 6 = 5.50
        assert result.gpa_10 == Decimal("5.50")


# ---------------------------------------------------------------------------
# Simulate GPA
# ---------------------------------------------------------------------------


class TestSimulateGpa:
    def test_adds_hypothetical(self) -> None:
        current = [
            EnrollmentRow(credits=3, final_grade_10=Decimal("7.0")),
        ]
        hypo = [
            EnrollmentRow(credits=3, final_grade_10=Decimal("9.0")),
        ]
        result = simulate_gpa(current, hypo)
        # (3*7 + 3*9) / 6 = 48/6 = 8.0
        assert result.gpa_10 == Decimal("8.00")


# ---------------------------------------------------------------------------
# Reverse calculator
# ---------------------------------------------------------------------------


class TestReverseCalculate:
    def test_basic(self) -> None:
        # Current GPA: 7.0, earned 30 credits
        # Want 8.0, remaining 30 credits
        # Need: (8.0 * 60 - 7.0 * 30) / 30 = (480 - 210) / 30 = 9.0
        result = reverse_calculate(
            current_gpa_10=Decimal("7.0"),
            earned_credits=30,
            target_gpa_10=Decimal("8.0"),
            remaining_credits=30,
        )
        assert result.required_avg_10 == Decimal("9.00")
        assert result.achievable is True

    def test_impossible(self) -> None:
        result = reverse_calculate(
            current_gpa_10=Decimal("5.0"),
            earned_credits=100,
            target_gpa_10=Decimal("9.0"),
            remaining_credits=10,
        )
        # (9.0 * 110 - 5.0 * 100) / 10 = (990 - 500) / 10 = 49.0
        assert result.achievable is False
        assert result.required_avg_10 == Decimal("10")  # clamped

    def test_already_achieved(self) -> None:
        result = reverse_calculate(
            current_gpa_10=Decimal("8.0"),
            earned_credits=30,
            target_gpa_10=Decimal("7.0"),
            remaining_credits=0,
        )
        assert result.achievable is True

    def test_zero_remaining_not_achieved(self) -> None:
        result = reverse_calculate(
            current_gpa_10=Decimal("6.0"),
            earned_credits=30,
            target_gpa_10=Decimal("7.0"),
            remaining_credits=0,
        )
        assert result.achievable is False


# ---------------------------------------------------------------------------
# Retake estimator
# ---------------------------------------------------------------------------


class TestRetakeEstimate:
    def test_basic(self) -> None:
        rows = [
            EnrollmentRow(credits=3, final_grade_10=Decimal("5.0")),
            EnrollmentRow(credits=3, final_grade_10=Decimal("8.0")),
        ]
        # Old GPA: (15+24)/6 = 6.50
        # Replace first with 8.0: (24+24)/6 = 8.00
        result = retake_estimate(rows, retake_index=0, new_grade_10=Decimal("8.0"))
        assert result.old_gpa_10 == Decimal("6.50")
        assert result.new_gpa_10 == Decimal("8.00")
        assert result.delta_gpa_10 == Decimal("1.50")

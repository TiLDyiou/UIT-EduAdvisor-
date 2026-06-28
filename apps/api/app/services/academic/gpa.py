"""GPA calculation logic – pure functions, no DB dependency.

All functions accept pre-loaded data (Decimals, lists of dicts) so they
are trivially testable.

Grade scale conversion follows the common UIT mapping.  Admin should
confirm against the official regulation before production use.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

# ---------------------------------------------------------------------------
# Scale conversion
# ---------------------------------------------------------------------------

PASS_THRESHOLD = Decimal("5.0")


def is_passed(score_10: Decimal | None) -> bool:
    """A course is passed when the final grade (scale 10) >= 4.0."""
    if score_10 is None:
        return False
    return score_10 >= PASS_THRESHOLD


# ---------------------------------------------------------------------------
# GPA computation
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class GpaResult:
    gpa_10: Decimal
    total_credits: int  # credits attempted (all enrolled with grades)
    earned_credits: int  # credits where passed


@dataclass(frozen=True)
class EnrollmentRow:
    """Lightweight view of an enrollment for GPA calculation."""

    credits: int
    final_grade_10: Decimal | None
    course_id: str | None = None
    term_code: str | None = None


def compute_cumulative_gpa(rows: list[EnrollmentRow]) -> GpaResult:
    """Weighted GPA across all enrollments that have a final grade.

    Only rows with ``final_grade_10 is not None`` contribute.
    """
    total_credits = 0
    earned_credits = 0
    weighted_sum_10 = Decimal("0")

    best_grades: dict[str, EnrollmentRow] = {}
    unique_rows: list[EnrollmentRow] = []

    def get_term_score(term: str | None) -> int:
        if not term:
            return 0
        import re
        # e.g., "HK1_2024-2025" -> (1, 2024) -> 20241
        m = re.search(r"HK(\d+)_(\d{4})", term)
        if m:
            return int(m.group(2)) * 10 + int(m.group(1))
        return 0

    for r in rows:
        if r.final_grade_10 is None or r.credits <= 0:
            continue
            
        if r.course_id:
            if r.course_id not in best_grades:
                best_grades[r.course_id] = r
            else:
                current_score = get_term_score(best_grades[r.course_id].term_code)
                new_score = get_term_score(r.term_code)
                
                # Bốc lần học đến sau (latest term) thay vì điểm cao nhất.
                if new_score >= current_score:
                    best_grades[r.course_id] = r
        else:
            unique_rows.append(r)
            
    final_rows = list(best_grades.values()) + unique_rows

    for r in final_rows:
        total_credits += r.credits
        weighted_sum_10 += r.final_grade_10 * r.credits
        if is_passed(r.final_grade_10):
            earned_credits += r.credits

    if total_credits == 0:
        return GpaResult(
            gpa_10=Decimal("0"),
            total_credits=0,
            earned_credits=0,
        )

    gpa_10 = (weighted_sum_10 / total_credits).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return GpaResult(
        gpa_10=gpa_10,
        total_credits=total_credits,
        earned_credits=earned_credits,
    )


def simulate_gpa(
    current: list[EnrollmentRow],
    hypothetical: list[EnrollmentRow],
) -> GpaResult:
    """Compute GPA as if *hypothetical* enrollments were added to *current*."""
    return compute_cumulative_gpa(current + hypothetical)


# ---------------------------------------------------------------------------
# Reverse calculator
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ReverseResult:
    required_avg_10: Decimal
    achievable: bool


def reverse_calculate(
    current_gpa_10: Decimal,
    earned_credits: int,
    target_gpa_10: Decimal,
    remaining_credits: int,
) -> ReverseResult:
    """Determine the average score needed on remaining credits to reach *target_gpa_10*.

    Returns ``achievable=False`` when the required average exceeds 10.0 or
    remaining_credits is zero.
    """
    if remaining_credits <= 0:
        achievable = current_gpa_10 >= target_gpa_10
        return ReverseResult(
            required_avg_10=Decimal("0"),
            achievable=achievable,
        )

    total = earned_credits + remaining_credits
    needed_total = target_gpa_10 * total
    already = current_gpa_10 * earned_credits
    needed_remaining = needed_total - already

    avg_10 = (needed_remaining / remaining_credits).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    achievable = Decimal("0") <= avg_10 <= Decimal("10")
    # Clamp for display even when not achievable.
    clamped = max(Decimal("0"), min(avg_10, Decimal("10")))

    return ReverseResult(
        required_avg_10=clamped,
        achievable=achievable,
    )


# ---------------------------------------------------------------------------
# Retake estimator
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RetakeResult:
    old_gpa_10: Decimal
    new_gpa_10: Decimal
    delta_gpa_10: Decimal


def retake_estimate(
    enrollments: list[EnrollmentRow],
    retakes: dict[int, Decimal],
) -> RetakeResult:
    """Estimate GPA change when retaking specific enrollments.

    ``retakes`` is a mapping from position in *enrollments* to the new grade.
    The old grade is replaced by *new_grade_10*.
    """
    old = compute_cumulative_gpa(enrollments)

    updated = list(enrollments)
    for retake_index, new_grade_10 in retakes.items():
        original = updated[retake_index]
        updated[retake_index] = EnrollmentRow(
            credits=original.credits,
            final_grade_10=new_grade_10,
        )
    new = compute_cumulative_gpa(updated)

    return RetakeResult(
        old_gpa_10=old.gpa_10,
        new_gpa_10=new.gpa_10,
        delta_gpa_10=new.gpa_10 - old.gpa_10,
    )

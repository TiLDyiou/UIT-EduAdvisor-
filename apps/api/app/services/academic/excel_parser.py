"""Parse UIT TKB Excel file into Section dataclasses.

The official TKB file has sheet ``TKB LT`` with a header row at index 3
(0-based).  Each data row from index 4 onwards describes one section
(nhóm lớp) of a course.

Key format quirks handled here:
- TIẾT is concatenated digits: ``123`` → periods [1,2,3].
  For periods ≥ 10, comma-separated: ``11,12,13``.
  Digit ``0`` means period 10.
- THỨ ``*`` means unscheduled – these rows are skipped.
- SĨ SỐ format is ``50(0)`` – we parse the number before ``(``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from io import BytesIO
from typing import BinaryIO

import openpyxl


@dataclass(frozen=True)
class Section:
    """One section (nhóm lớp) parsed from the TKB Excel."""

    course_code: str  # MÃ MH, e.g. "CE118"
    section_code: str  # MÃ LỚP, e.g. "CE118.Q11"
    course_name: str  # TÊN MÔN HỌC
    credits: int  # TỐ TC
    is_lab: bool  # True if THỰC HÀNH == 1
    teaching_type: str  # HTGD: LT, HT1, HT2, TG
    day_of_week: int  # 2=Mon … 7=Sat
    periods: list[int] = field(default_factory=list)  # e.g. [1,2,3]
    biweekly: bool = False  # True if CÁCH TUẦN == 2
    room: str = ""
    capacity: int = 0
    instructor_name: str = ""
    start_date: str = ""  # ISO date string, e.g. "2025-09-08"
    end_date: str = ""
    program: str = ""  # HỆ ĐT: CQUI, CLC, CNTN, ...
    department: str = ""  # KHOA QL


# Column indices in the TKB LT sheet (0-based, header row at index 3).
_COL_MA_MH = 1
_COL_MA_LOP = 2
_COL_TEN_MH = 3
_COL_TEN_GV = 5
_COL_SI_SO = 6
_COL_TO_TC = 7
_COL_THUC_HANH = 8
_COL_HTGD = 9
_COL_THU = 10
_COL_TIET = 11
_COL_CACH_TUAN = 12
_COL_PHONG = 13
_COL_HE_DT = 17
_COL_KHOA_QL = 18
_COL_NBD = 19
_COL_NKT = 20

_HEADER_ROW_IDX = 3  # 0-based row index of the header
_SKIP_HTGD = {"KLTN", "TTTN", "ĐA"}  # thesis/internship – no schedule


def parse_periods(raw: str | int | None) -> list[int]:
    """Parse the TIẾT column into a sorted list of period numbers.

    Examples::

        "123"       → [1, 2, 3]
        "6789"      → [6, 7, 8, 9]
        "90"        → [9, 10]           # 0 means period 10
        "67890"     → [6, 7, 8, 9, 10]
        "11,12,13"  → [11, 12, 13]
        "*"         → []
    """
    if raw is None:
        return []
    s = str(raw).strip()
    if s == "*" or not s:
        return []

    # Comma-separated (for periods >= 10).
    if "," in s:
        return sorted(int(x) for x in s.split(",") if x.strip().isdigit())

    # Concatenated single digits.  '0' means period 10.
    periods: list[int] = []
    for ch in s:
        if ch.isdigit():
            periods.append(10 if ch == "0" else int(ch))
    return sorted(periods)


def _parse_capacity(raw: str | int | None) -> int:
    """Extract capacity from format like ``50(0)``."""
    if raw is None:
        return 0
    s = str(raw).strip()
    m = re.match(r"(\d+)", s)
    return int(m.group(1)) if m else 0


def _parse_date(raw) -> str:
    """Convert date cell to ISO string."""
    if raw is None:
        return ""
    if hasattr(raw, "isoformat"):
        return raw.isoformat()[:10]
    return str(raw).strip()[:10]


def parse_tkb_excel(file: BinaryIO | bytes) -> list[Section]:
    """Parse a TKB Excel file and return schedulable sections.

    Rows with THỨ=``*`` or HTGD in {KLTN, TTTN, ĐA} are skipped
    because they have no fixed schedule.
    """
    if isinstance(file, bytes):
        file = BytesIO(file)

    wb = openpyxl.load_workbook(file, data_only=True)
    ws = wb["TKB LT"]

    sections: list[Section] = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i <= _HEADER_ROW_IDX:
            continue

        ma_mh = row[_COL_MA_MH]
        if ma_mh is None:
            continue

        htgd = str(row[_COL_HTGD] or "").strip()
        if htgd in _SKIP_HTGD:
            continue

        thu_raw = str(row[_COL_THU] or "").strip()
        if thu_raw == "*" or not thu_raw:
            continue
        try:
            day_of_week = int(thu_raw)
        except ValueError:
            continue

        periods = parse_periods(row[_COL_TIET])
        if not periods:
            continue

        credits_raw = row[_COL_TO_TC]
        try:
            credits = int(credits_raw) if credits_raw is not None else 0
        except (ValueError, TypeError):
            credits = 0

        is_lab_raw = row[_COL_THUC_HANH]
        is_lab = bool(is_lab_raw) and is_lab_raw != 0

        biweekly_raw = row[_COL_CACH_TUAN]
        biweekly = str(biweekly_raw).strip() == "2" if biweekly_raw is not None else False

        sections.append(
            Section(
                course_code=str(ma_mh).strip(),
                section_code=str(row[_COL_MA_LOP] or "").strip(),
                course_name=str(row[_COL_TEN_MH] or "").strip(),
                credits=credits,
                is_lab=is_lab,
                teaching_type=htgd,
                day_of_week=day_of_week,
                periods=periods,
                biweekly=biweekly,
                room=str(row[_COL_PHONG] or "").strip(),
                capacity=_parse_capacity(row[_COL_SI_SO]),
                instructor_name=str(row[_COL_TEN_GV] or "").strip(),
                start_date=_parse_date(row[_COL_NBD]),
                end_date=_parse_date(row[_COL_NKT]),
                program=str(row[_COL_HE_DT] or "").strip(),
                department=str(row[_COL_KHOA_QL] or "").strip(),
            )
        )

    wb.close()
    return sections

"""ICS calendar export with stable UIDs.

Each event gets a deterministic UID so re-importing into Google Calendar
or Apple Calendar updates existing events rather than creating duplicates.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta, timezone
from typing import Sequence

from icalendar import Calendar, Event

from app.services.academic.excel_parser import Section

# ---------------------------------------------------------------------------
# UIT period → time mapping
# ---------------------------------------------------------------------------
# UIT has 13 periods.  Periods 1-5 are morning, 6-10 afternoon, 11-13 evening.
# Each period is 50 minutes.  Break between period 5 and 6.

_PERIOD_START: dict[int, tuple[int, int]] = {
    1: (7, 0),
    2: (7, 50),
    3: (8, 40),
    4: (9, 35),
    5: (10, 25),
    6: (13, 0),
    7: (13, 50),
    8: (14, 40),
    9: (15, 35),
    10: (16, 25),
    11: (17, 15),
    12: (18, 5),
    13: (18, 55),
}

_PERIOD_DURATION_MIN = 50


def period_to_time(period: int) -> tuple[int, int]:
    """Return (hour, minute) for the start of a period."""
    return _PERIOD_START.get(period, (7, 0))


def period_end_time(period: int) -> tuple[int, int]:
    """Return (hour, minute) for the end of a period (start + 50 min)."""
    h, m = period_to_time(period)
    total = h * 60 + m + _PERIOD_DURATION_MIN
    return total // 60, total % 60


# ---------------------------------------------------------------------------
# Stable UID
# ---------------------------------------------------------------------------

_TZ_HCMC = timezone(timedelta(hours=7))

_DAY_NAME = {2: "MO", 3: "TU", 4: "WE", 5: "TH", 6: "FR", 7: "SA"}


def stable_uid(student_id: str, course_code: str, week_start: date) -> str:
    """SHA-256 based stable UID for an ICS event.

    ``UID = sha256(student_id + course_code + week_start_iso) @ uit-eduadvisor``
    """
    raw = f"{student_id}:{course_code}:{week_start.isoformat()}"
    h = hashlib.sha256(raw.encode()).hexdigest()
    return f"{h}@uit-eduadvisor"


def _monday_of(d: date) -> date:
    """Return Monday of the ISO week containing *d*."""
    return d - timedelta(days=d.weekday())


# ---------------------------------------------------------------------------
# ICS generation
# ---------------------------------------------------------------------------

def generate_ics(
    student_id: str,
    sections: Sequence[Section],
    term_start: date,
    term_weeks: int = 16,
) -> bytes:
    """Generate an ICS calendar from scheduled sections.

    Parameters
    ----------
    student_id :
        Used for stable UID generation.
    sections :
        The chosen schedule (list of Section).
    term_start :
        The Monday of the first week of the term.
    term_weeks :
        Number of weeks in the term.

    Returns
    -------
    bytes
        The ICS file content encoded as UTF-8.
    """
    cal = Calendar()
    cal.add("prodid", "-//UIT EduAdvisor//Scheduler//VI")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-calname", "UIT TKB")
    cal.add("x-wr-timezone", "Asia/Ho_Chi_Minh")

    # Ensure term_start is a Monday.
    term_start_monday = _monday_of(term_start)

    for section in sections:
        # day_of_week: 2=Mon → offset 0, 3=Tue → offset 1, ...
        day_offset = section.day_of_week - 2
        if day_offset < 0 or day_offset > 5:
            continue

        if not section.periods:
            continue

        first_period = min(section.periods)
        last_period = max(section.periods)
        start_h, start_m = period_to_time(first_period)
        end_h, end_m = period_end_time(last_period)

        step = 2 if section.biweekly else 1

        for week in range(0, term_weeks, step):
            event_date = term_start_monday + timedelta(days=day_offset + week * 7)
            week_start = _monday_of(event_date)

            uid = stable_uid(student_id, section.course_code, week_start)

            dtstart = datetime(
                event_date.year, event_date.month, event_date.day,
                start_h, start_m, tzinfo=_TZ_HCMC,
            )
            dtend = datetime(
                event_date.year, event_date.month, event_date.day,
                end_h, end_m, tzinfo=_TZ_HCMC,
            )

            ev = Event()
            ev.add("uid", uid)
            ev.add("dtstart", dtstart)
            ev.add("dtend", dtend)
            ev.add("summary", f"{section.course_code} - {section.course_name}")
            ev.add("location", section.room)
            ev.add("description", (
                f"Lớp: {section.section_code}\n"
                f"GV: {section.instructor_name}\n"
                f"Tiết: {','.join(str(p) for p in section.periods)}"
            ))
            cal.add_component(ev)

    return cal.to_ical()

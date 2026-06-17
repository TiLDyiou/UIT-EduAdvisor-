"""Bot command handlers: platform-agnostic, return plain text."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.academic import Course, Deadline, Enrollment, Exam, Schedule
from app.db.models.bot import ReminderPreference
from app.db.models.core_security import Student
from app.schemas.bot import NormalizedCommand
from app.services.academic.gpa import EnrollmentRow, compute_cumulative_gpa
from app.services.bot.bot_linking import find_student_by_platform, redeem_link_token

import uuid


# ---------------------------------------------------------------------------
# Day-of-week helpers (UIT convention: 2=Mon..7=Sat, 8=Sun)
# ---------------------------------------------------------------------------

_DAY_NAMES = {2: "Thứ 2", 3: "Thứ 3", 4: "Thứ 4", 5: "Thứ 5", 6: "Thứ 6", 7: "Thứ 7", 8: "CN"}

_DAY_PARSE = {
    "thu2": 2, "t2": 2,
    "thu3": 3, "t3": 3,
    "thu4": 4, "t4": 4,
    "thu5": 5, "t5": 5,
    "thu6": 6, "t6": 6,
    "thu7": 7, "t7": 7,
    "cn": 8, "chunhat": 8,
}


def _parse_day(arg: str) -> int | None:
    cleaned = re.sub(r"[\s_-]", "", arg.lower())
    return _DAY_PARSE.get(cleaned)


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

_HELP_TEXT = """Danh sach lenh:
/tkb - TKB tuan hien tai
/tkb [thu] - TKB ngay cu the (VD: /tkb thu4)
/lithi - Lich thi 7 ngay toi
/deadline - Deadline sap toi
/gpa - GPA tich luy
/nhacnho thi on|off - Bat/tat nhac lich thi
/nhacnho deadline on|off - Bat/tat nhac deadline
/nhacnho status - Xem trang thai nhac nho
/help - Danh sach lenh"""


_UNLINKED_TEXT = (
    "Tai khoan chua duoc lien ket.\n"
    "Vao UIT EduAdvisor > Settings > Ket noi Bot de lay ma lien ket."
)

_START_TEXT = (
    "Chao ban! Day la UIT EduAdvisor Bot.\n\n"
    + _UNLINKED_TEXT
)


async def _cmd_start(db: AsyncSession, cmd: NormalizedCommand) -> str:
    """Handle /start [link_token]."""
    token_str = cmd.args.strip()
    if not token_str:
        # Check if already linked
        student = await find_student_by_platform(db, cmd.platform, cmd.platform_user_id)
        if student:
            return "Tai khoan da lien ket! Gui /help de xem danh sach lenh."
        return _START_TEXT

    # Try to redeem token
    try:
        token_uuid = uuid.UUID(token_str)
    except ValueError:
        return "Ma lien ket khong hop le."

    account = await redeem_link_token(db, token_uuid, cmd.platform_user_id)
    if account is None:
        return "Ma lien ket khong hop le, da het han, hoac da su dung."
    await db.commit()
    return "Lien ket thanh cong! Gui /help de xem danh sach lenh."


async def _cmd_help(db: AsyncSession, cmd: NormalizedCommand) -> str:
    return _HELP_TEXT


async def _cmd_tkb(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> str:
    day_filter = _parse_day(cmd.args) if cmd.args.strip() else None

    query = (
        select(Schedule)
        .options(selectinload(Schedule.course))
        .where(Schedule.student_id == student.id)
    )
    if day_filter is not None:
        query = query.where(Schedule.day_of_week == day_filter)
    query = query.order_by(Schedule.day_of_week, Schedule.start_period)

    res = await db.execute(query)
    schedules = list(res.scalars().all())

    if not schedules:
        if day_filter is not None:
            return f"Khong co lich hoc {_DAY_NAMES.get(day_filter, '')}."
        return "Chua co du lieu TKB."

    lines: list[str] = []
    current_day = -1
    for s in schedules:
        if s.day_of_week != current_day:
            current_day = s.day_of_week
            lines.append(f"\n{_DAY_NAMES.get(s.day_of_week, f'Day {s.day_of_week}')}:")
        course_name = s.course.name if s.course else "?"
        room = s.room or "?"
        lines.append(f"  Tiet {s.start_period}-{s.end_period}: {course_name} ({room})")

    header = "TKB" if day_filter is None else f"TKB {_DAY_NAMES.get(day_filter, '')}"
    return f"{header}:{''.join(lines)}"


async def _cmd_lithi(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> str:
    now = datetime.now(timezone.utc)
    week_later = now + timedelta(days=7)
    res = await db.execute(
        select(Exam)
        .options(selectinload(Exam.course))
        .where(
            Exam.student_id == student.id,
            Exam.exam_date >= now.date(),
            Exam.exam_date <= week_later.date(),
        )
        .order_by(Exam.exam_date, Exam.start_time)
    )
    exams = list(res.scalars().all())
    if not exams:
        return "Khong co lich thi trong 7 ngay toi."

    lines = ["Lich thi 7 ngay toi:"]
    for e in exams:
        course_name = e.course.name if e.course else "?"
        room = e.room or "?"
        lines.append(
            f"  {e.exam_date.strftime('%d/%m')} "
            f"{e.start_time.strftime('%H:%M')}-{e.end_time.strftime('%H:%M')}: "
            f"{course_name} ({room})"
        )
    return "\n".join(lines)


async def _cmd_deadline(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> str:
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(Deadline)
        .options(selectinload(Deadline.course))
        .where(
            Deadline.student_id == student.id,
            Deadline.completed_at.is_(None),
            Deadline.due_at >= now,
        )
        .order_by(Deadline.due_at)
        .limit(10)
    )
    deadlines = list(res.scalars().all())
    if not deadlines:
        return "Khong co deadline nao sap toi."

    lines = ["Deadline sap toi:"]
    for d in deadlines:
        course_name = d.course.name if d.course else ""
        due_str = d.due_at.strftime("%d/%m %H:%M")
        prefix = f"[{course_name}] " if course_name else ""
        lines.append(f"  {due_str}: {prefix}{d.title}")
    return "\n".join(lines)


async def _cmd_gpa(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> str:
    res = await db.execute(
        select(Enrollment)
        .options(selectinload(Enrollment.course))
        .where(Enrollment.student_id == student.id)
    )
    enrollments = list(res.scalars().all())
    if not enrollments:
        return "Chua co du lieu diem."

    rows = [
        EnrollmentRow(credits=e.course.credits if e.course else 0, final_grade_10=e.final_grade_10)
        for e in enrollments
    ]
    result = compute_cumulative_gpa(rows)
    return (
        f"GPA tich luy:\n"
        f"  Thang 10: {result.gpa_10}\n"
        f"  Thang 4:  {result.gpa_4}\n"
        f"  Tin chi tich luy: {result.earned_credits}/{result.total_credits}"
    )


async def _cmd_nhacnho(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> str:
    parts = cmd.args.strip().lower().split()
    if not parts:
        return "Cu phap: /nhacnho thi|deadline on|off hoac /nhacnho status"

    kind = parts[0]

    if kind == "status":
        res = await db.execute(
            select(ReminderPreference).where(ReminderPreference.student_id == student.id).limit(1)
        )
        pref = res.scalar_one_or_none()
        if pref is None:
            return "Nhac lich thi: BAT\nNhac deadline: BAT"
        exam_status = "BAT" if pref.exam_reminder else "TAT"
        deadline_status = "BAT" if pref.deadline_reminder else "TAT"
        return f"Nhac lich thi: {exam_status}\nNhac deadline: {deadline_status}"

    if len(parts) < 2 or parts[1] not in ("on", "off"):
        return "Cu phap: /nhacnho thi|deadline on|off"

    action = parts[1] == "on"

    if kind not in ("thi", "deadline"):
        return "Cu phap: /nhacnho thi|deadline on|off"

    # Upsert reminder preference
    res = await db.execute(
        select(ReminderPreference).where(ReminderPreference.student_id == student.id).limit(1)
    )
    pref = res.scalar_one_or_none()
    if pref is None:
        pref = ReminderPreference(student_id=student.id)
        db.add(pref)

    if kind == "thi":
        pref.exam_reminder = action
    else:
        pref.deadline_reminder = action

    await db.flush()
    await db.commit()

    status = "BAT" if action else "TAT"
    label = "lich thi" if kind == "thi" else "deadline"
    return f"Da {status.lower()} nhac {label}."


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

# Commands that don't require a linked account
_PUBLIC_COMMANDS = {"/start", "/help"}


async def dispatch_command(db: AsyncSession, cmd: NormalizedCommand) -> str:
    """Route a normalized command to the appropriate handler. Returns response text."""
    command = cmd.command.lower().strip()

    # Public commands (no link required)
    if command == "/start":
        return await _cmd_start(db, cmd)
    if command == "/help":
        return await _cmd_help(db, cmd)

    # All other commands require a linked account
    student = await find_student_by_platform(db, cmd.platform, cmd.platform_user_id)
    if student is None:
        return _UNLINKED_TEXT

    if command == "/tkb":
        return await _cmd_tkb(db, cmd, student)
    if command == "/lithi":
        return await _cmd_lithi(db, cmd, student)
    if command == "/deadline":
        return await _cmd_deadline(db, cmd, student)
    if command == "/gpa":
        return await _cmd_gpa(db, cmd, student)
    if command == "/nhacnho":
        return await _cmd_nhacnho(db, cmd, student)

    return "Lenh khong hop le. Gui /help de xem danh sach lenh."

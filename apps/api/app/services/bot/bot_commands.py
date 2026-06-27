"""Bot command handlers: platform-agnostic, return plain text."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.academic import Deadline, Enrollment, Exam, Schedule
from app.db.models.bot import ReminderPreference
from app.db.models.core_security import Student, SyncJob
from app.schemas.bot import NormalizedCommand
from app.services.academic.gpa import EnrollmentRow, compute_cumulative_gpa
from app.services.bot.bot_linking import find_student_by_platform, redeem_link_token
from app.services.bot.tkb_renderer import render_tkb

# ---------------------------------------------------------------------------
# Day-of-week helpers (UIT convention: 2=Mon..7=Sat, 8=Sun)
# ---------------------------------------------------------------------------

_DAY_NAMES = {2: "Thứ 2", 3: "Thứ 3", 4: "Thứ 4", 5: "Thứ 5", 6: "Thứ 6", 7: "Thứ 7", 8: "CN"}

_DAY_PARSE = {
    "thu2": 2, "t2": 2, "2": 2,
    "thu3": 3, "t3": 3, "3": 3,
    "thu4": 4, "t4": 4, "4": 4,
    "thu5": 5, "t5": 5, "5": 5,
    "thu6": 6, "t6": 6, "6": 6,
    "thu7": 7, "t7": 7, "7": 7,
    "cn": 8, "chunhat": 8, "8": 8,
}


def _parse_day(arg: str) -> int | None:
    cleaned = re.sub(r"[\s_-]", "", arg.lower())
    
    if cleaned in ("mai", "ngaymai", "tomorrow"):
        from datetime import timezone
        now = datetime.now(timezone(timedelta(hours=7)))
        tomorrow = now + timedelta(days=1)
        # weekday(): Monday is 0, Sunday is 6
        return (tomorrow.weekday() % 7) + 2
        
    if cleaned in ("nay", "homnay", "today"):
        from datetime import timezone
        now = datetime.now(timezone(timedelta(hours=7)))
        return (now.weekday() % 7) + 2
        
    return _DAY_PARSE.get(cleaned)


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

_HELP_TEXT = """Danh sách lệnh:
/tkb - TKB tuần hiện tại
/tkb [thu] - TKB ngày cụ thể (VD: /tkb 4, /tkb mai, /tkb nay)
/lithi - Lịch thi 7 ngày tới
/deadline (hoặc /dl) - Deadline sắp tới
/gpa - GPA tích lũy
/nhacnho thi on|off - Bật/tắt nhắc lịch thi
/nhacnho deadline on|off - Bật/tắt nhắc deadline
/nhacnho status - Xem trạng thái nhắc nhở
/help - Danh sách lệnh"""


_UNLINKED_TEXT = (
    "Tài khoản chưa được liên kết.\n"
    "Vào UIT EduAdvisor > Settings > Kết nối Bot để lấy mã liên kết."
)

_START_TEXT = "Chào bạn! Đây là UIT EduAdvisor Bot.\n\n" + _UNLINKED_TEXT


async def _cmd_start(db: AsyncSession, cmd: NormalizedCommand) -> tuple[str, bytes | None]:
    """Handle /start [link_token]."""
    token_str = cmd.args.strip()
    if not token_str:
        # Check if already linked
        student = await find_student_by_platform(db, cmd.platform, cmd.platform_user_id)
        if student:
            return "Tài khoản đã liên kết! Gửi /help để xem danh sách lệnh.", None
        return _START_TEXT, None

    # Try to redeem token
    try:
        token_uuid = uuid.UUID(token_str)
    except ValueError:
        return "Mã liên kết không hợp lệ.", None

    account = await redeem_link_token(db, token_uuid, cmd.platform_user_id)
    if account is None:
        return "Mã liên kết không hợp lệ, đã hết hạn, hoặc đã sử dụng.", None
    await db.commit()
    return "Liên kết thành công! Gửi /help để xem danh sách lệnh.", None


async def _cmd_help(db: AsyncSession, cmd: NormalizedCommand) -> tuple[str, bytes | None]:
    return _HELP_TEXT, None


async def _cmd_tkb(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> tuple[str, bytes | None]:
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
            return f"Không có lịch học {_DAY_NAMES.get(day_filter, '').lower()}.", None
        return "Chưa có dữ liệu TKB.", None

    header = "Thời khoá biểu cả tuần" if day_filter is None else f"Thời khoá biểu {_DAY_NAMES.get(day_filter, '').lower()}"
    lines: list[str] = []
    
    # Group schedules by day
    from collections import defaultdict
    sched_by_day = defaultdict(list)
    for s in schedules:
        sched_by_day[s.day_of_week].append(s)

    days_to_show = range(2, 9) if day_filter is None else [day_filter]
    
    for day in days_to_show:
        day_name = _DAY_NAMES.get(day, f"Thứ {day}")
        lines.append(f"- {day_name}:")
        
        day_scheds = sched_by_day.get(day, [])
        if not day_scheds:
            lines.append("  (Trống)")
            continue
            
        for s in day_scheds:
            # Cleanup long names from legacy HTML parsing if any
            raw_name = s.course.name if s.course else "?"
            # Heuristic to remove everything after " - VN" or " - EN" if it leaked
            import re
            clean_name = re.sub(r' - (VN|EN).*$', '', raw_name).strip()
            # Also remove duplicate course code in name if it exists
            course_code = s.course.code if s.course and s.course.code else "?"
            if clean_name.startswith(course_code):
                clean_name = clean_name[len(course_code):].strip()
            
            room = (s.room or "?").replace(" ", "").replace(".", "")
            
            week_pattern = s.week_pattern if s.week_pattern else "Hàng tuần"
            wp_str = f" ({week_pattern})" if week_pattern and "Cách" in week_pattern else ""
            
            lines.append(f"  - Tiết {s.start_period}-{s.end_period}, {course_code} {clean_name}, P.{room}{wp_str}")

    return f"{header}:\n" + "\n".join(lines), None


async def _cmd_lithi(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> tuple[str, bytes | None]:
    now = datetime.now(UTC)
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
        return "Không có lịch thi trong 7 ngày tới.", None

    lines = ["Lịch thi 7 ngày tới:"]
    for e in exams:
        course_name = e.course.name if e.course else "?"
        room = e.room or "?"
        lines.append(
            f"  {e.exam_date.strftime('%d/%m')} "
            f"{e.start_time.strftime('%H:%M')}-{e.end_time.strftime('%H:%M')}: "
            f"{course_name} ({room})"
        )
    return "\n".join(lines), None


async def _cmd_deadline(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> tuple[str, bytes | None]:
    now = datetime.now(UTC)
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
        return "Không có deadline nào sắp tới.", None

    lines = ["Deadline sắp tới:"]
    from zoneinfo import ZoneInfo
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    for d in deadlines:
        course_name = d.course.name if d.course else ""
        due_local = d.due_at.astimezone(tz)
        due_str = due_local.strftime("%d/%m %H:%M")
        prefix = f"[{course_name}] " if course_name else ""
        lines.append(f"  {due_str}: {prefix}{d.title}")
    return "\n".join(lines), None


async def _cmd_gpa(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> tuple[str, bytes | None]:
    res = await db.execute(
        select(SyncJob)
        .where(SyncJob.student_id == student.id, SyncJob.status == "completed")
        .order_by(SyncJob.created_at.desc())
        .limit(1)
    )
    job = res.scalar_one_or_none()

    if job and job.result_summary and "daa_dtbctl_10" in job.result_summary:
        gpa_10 = job.result_summary.get("daa_dtbctl_10")
        earned_credits = job.result_summary.get("daa_earned_credits")
    else:
        # Fallback to local calculation
        res_enroll = await db.execute(
            select(Enrollment)
            .options(selectinload(Enrollment.course))
            .where(Enrollment.student_id == student.id)
        )
        enrollments = list(res_enroll.scalars().all())
        if not enrollments:
            return "Chưa có dữ liệu điểm.", None

        rows = [
            EnrollmentRow(credits=e.course.credits if e.course else 0, final_grade_10=e.final_grade_10)
            for e in enrollments
        ]
        result = compute_cumulative_gpa(rows)
        gpa_10 = result.gpa_10
        earned_credits = result.earned_credits

    return (
        f"Điểm trung bình chung tích lũy: {gpa_10}\n"
        f"Số tín chỉ tích lũy: {earned_credits}"
    ), None


async def _cmd_nhacnho(db: AsyncSession, cmd: NormalizedCommand, student: Student) -> tuple[str, bytes | None]:
    parts = cmd.args.strip().lower().split()
    if not parts:
        return "Cú pháp: /nhacnho thi|deadline on|off hoặc /nhacnho status", None

    kind = parts[0]

    if kind == "status":
        res = await db.execute(
            select(ReminderPreference).where(ReminderPreference.student_id == student.id).limit(1)
        )
        pref = res.scalar_one_or_none()
        if pref is None:
            return "Nhắc lịch thi: BẬT\nNhắc deadline: BẬT", None
        exam_status = "BẬT" if pref.exam_reminder else "TẮT"
        deadline_status = "BẬT" if pref.deadline_reminder else "TẮT"
        return f"Nhắc lịch thi: {exam_status}\nNhắc deadline: {deadline_status}", None

    if len(parts) < 2 or parts[1] not in ("on", "off"):
        return "Cú pháp: /nhacnho thi|deadline on|off", None

    action = parts[1] == "on"

    if kind not in ("thi", "deadline"):
        return "Cú pháp: /nhacnho thi|deadline on|off", None

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

    status = "BẬT" if action else "TẮT"
    label = "lịch thi" if kind == "thi" else "deadline"
    return f"Đã {status.lower()} nhắc {label}.", None


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

# Commands that don't require a linked account
_PUBLIC_COMMANDS = {"/start", "/help"}


async def dispatch_command(db: AsyncSession, cmd: NormalizedCommand) -> tuple[str, bytes | None]:
    """Route a normalized command to the appropriate handler. Returns (response text, optional image bytes)."""
    command = cmd.command.lower().strip()

    # Public commands (no link required)
    if command == "/start":
        return await _cmd_start(db, cmd)
    if command == "/help":
        return await _cmd_help(db, cmd)

    # All other commands require a linked account
    student = await find_student_by_platform(db, cmd.platform, cmd.platform_user_id)
    if student is None:
        return _UNLINKED_TEXT, None

    if command == "/tkb":
        return await _cmd_tkb(db, cmd, student)
    if command == "/lithi":
        return await _cmd_lithi(db, cmd, student)
    if command in ("/deadline", "/dl"):
        return await _cmd_deadline(db, cmd, student)
    if command == "/gpa":
        return await _cmd_gpa(db, cmd, student)
    if command == "/nhacnho":
        return await _cmd_nhacnho(db, cmd, student)

    return "Lệnh không hợp lệ. Gửi /help để xem danh sách lệnh.", None

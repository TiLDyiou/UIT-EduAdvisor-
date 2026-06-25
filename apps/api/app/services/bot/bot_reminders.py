"""Reminder checker: scan upcoming exams/deadlines and send notifications."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.models.academic import Deadline, Exam
from app.db.models.bot import BotAccount, ReminderPreference
from app.services.bot.platform_sender import PlatformSender

logger = logging.getLogger(__name__)


def _get_exam_shift(start_time: time) -> str:
    # Mapping start_time back to Ca Thi (exam shift/session) at UIT
    # Standard: Ca 1 (7:30), Ca 2 (9:45), Ca 3 (13:30), Ca 4 (15:45)
    if start_time == time(7, 30):
        return "Ca 1"
    elif start_time == time(9, 45):
        return "Ca 2"
    elif start_time == time(13, 30):
        return "Ca 3"
    elif start_time == time(15, 45):
        return "Ca 4"
    else:
        # Fallback based on hour range
        if start_time.hour < 9:
            return "Ca 1"
        elif start_time.hour < 12:
            return "Ca 2"
        elif start_time.hour < 15:
            return "Ca 3"
        else:
            return "Ca 4"


async def check_and_send_reminders(
    db: AsyncSession,
    redis: Redis,
    sender: PlatformSender,
) -> int:
    """Check for upcoming exams/deadlines and send reminders.

    Returns the number of reminders sent.
    """
    settings = get_settings()
    sent = 0
    sent += await _send_exam_reminders(db, redis, sender, settings.reminder_exam_hours_before)
    sent += await _send_deadline_reminders(
        db, redis, sender, settings.reminder_deadline_hours_before
    )
    return sent


async def _send_exam_reminders(
    db: AsyncSession,
    redis: Redis,
    sender: PlatformSender,
    hours_before: int,
) -> int:
    now = datetime.now(UTC)
    cutoff = now + timedelta(hours=hours_before)

    res = await db.execute(
        select(Exam)
        .options(selectinload(Exam.course))
        .where(
            Exam.exam_date >= now.date(),
            Exam.exam_date <= cutoff.date(),
        )
    )
    exams = list(res.scalars().all())
    if not exams:
        return 0

    sent = 0
    for exam in exams:
        # Check reminder preference
        pref_res = await db.execute(
            select(ReminderPreference)
            .where(
                ReminderPreference.student_id == exam.student_id,
                ReminderPreference.exam_reminder.is_(True),
            )
            .limit(1)
        )
        if pref_res.scalar_one_or_none() is None:
            continue

        # Dedup
        dedup_key = f"reminder:{exam.student_id}:exam:{exam.id}"
        already_sent = await redis.set(dedup_key, "1", nx=True, ex=30 * 24 * 3600)
        if not already_sent:
            continue

        # Find linked bot accounts for this student
        acct_res = await db.execute(
            select(BotAccount).where(
                BotAccount.student_id == exam.student_id,
                BotAccount.unlinked_at.is_(None),
            )
        )
        accounts = list(acct_res.scalars().all())

        course_name = exam.course.name if exam.course else "?"
        course_code = exam.course.code if exam.course and exam.course.code else ""
        course_display = f"{course_code} - {course_name}" if course_code else course_name
        ca_thi = _get_exam_shift(exam.start_time)
        plain_msg = (
            f"Nhac nho lich thi:\n"
            f"  Mon: {course_display}\n"
            f"  Ngay: {exam.exam_date.strftime('%d/%m/%Y')}\n"
            f"  Ca: {ca_thi}"
        )
        if exam.room:
            plain_msg += f"\n  Phong: {exam.room}"

        html_msg = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UIT EduAdvisor - Nhắc nhở lịch thi sắp tới</title>
</head>
<body style="background-color: #f9fafb; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #1f2937;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 24px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
            <h2 style="font-size: 20px; font-weight: bold; color: #111827; margin: 0;">UIT EduAdvisor</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">Lịch thi môn học sắp diễn ra</p>
        </div>
        <div style="border-radius: 12px; border: 1px solid #e5e7eb; background-color: #ffffff; padding: 20px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
            <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">Thông tin phòng thi</h3>
            <div style="margin-bottom: 12px;">
                <span style="font-size: 14px; color: #6b7280; display: block; margin-bottom: 2px;">Môn học:</span>
                <span style="font-size: 16px; font-weight: 500; color: #111827;">{course_display}</span>
            </div>
            <div style="margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 24px;">
                <div style="flex: 1; min-width: 120px;">
                    <span style="font-size: 14px; color: #6b7280; display: block; margin-bottom: 2px;">Ngày thi:</span>
                    <span style="font-size: 16px; font-weight: 500; color: #111827;">{exam.exam_date.strftime("%d/%m/%Y")}</span>
                </div>
                <div style="flex: 1; min-width: 120px;">
                    <span style="font-size: 14px; color: #6b7280; display: block; margin-bottom: 2px;">Ca thi:</span>
                    <span style="font-size: 16px; font-weight: 500; color: #111827;">{ca_thi}</span>
                </div>
            </div>
            <div style="margin-bottom: 12px;">
                <span style="font-size: 14px; color: #6b7280; display: block; margin-bottom: 2px;">Phòng thi:</span>
                <span style="font-size: 16px; font-weight: 600; color: #2563eb;">{exam.room or "Chưa rõ"}</span>
            </div>
            <div style="margin-top: 16px;">
                <span style="background-color: #fef3c7; color: #d97706; font-size: 12px; font-weight: 500; border-radius: 9999px; padding: 4px 12px; display: inline-block;">Sắp diễn ra</span>
            </div>
        </div>
    </div>
</body>
</html>"""

        for acct in accounts:
            msg_to_send = html_msg if acct.platform == "mail" else plain_msg
            ok = await sender.send_message(acct.platform, acct.platform_user_id, msg_to_send)
            if ok:
                sent += 1
            else:
                logger.warning(
                    "reminder_send_failed",
                    extra={
                        "platform": acct.platform,
                        "student_id": str(exam.student_id),
                        "exam_id": exam.id,
                    },
                )

    return sent


async def _send_deadline_reminders(
    db: AsyncSession,
    redis: Redis,
    sender: PlatformSender,
    hours_before: int,
) -> int:
    now = datetime.now(UTC)
    cutoff = now + timedelta(hours=hours_before)

    res = await db.execute(
        select(Deadline)
        .options(selectinload(Deadline.course))
        .where(
            Deadline.completed_at.is_(None),
            Deadline.due_at >= now,
            Deadline.due_at <= cutoff,
        )
    )
    deadlines = list(res.scalars().all())
    if not deadlines:
        return 0

    sent = 0
    for dl in deadlines:
        pref_res = await db.execute(
            select(ReminderPreference)
            .where(
                ReminderPreference.student_id == dl.student_id,
                ReminderPreference.deadline_reminder.is_(True),
            )
            .limit(1)
        )
        if pref_res.scalar_one_or_none() is None:
            continue

        dedup_key = f"reminder:{dl.student_id}:deadline:{dl.id}"
        already_sent = await redis.set(dedup_key, "1", nx=True, ex=30 * 24 * 3600)
        if not already_sent:
            continue

        acct_res = await db.execute(
            select(BotAccount).where(
                BotAccount.student_id == dl.student_id,
                BotAccount.unlinked_at.is_(None),
            )
        )
        accounts = list(acct_res.scalars().all())

        course_name = dl.course.name if dl.course else ""
        course_code = dl.course.code if dl.course and dl.course.code else ""
        prefix = f"[{course_code}] " if course_code else ""

        local_tz = ZoneInfo("Asia/Ho_Chi_Minh")
        due_local = dl.due_at.astimezone(local_tz)
        due_text = due_local.strftime("%d/%m/%Y %H:%M")

        plain_msg = f"Nhac nho deadline:\n  {prefix}{dl.title}\n  Han: {due_text}"

        course_badge = ""
        if course_code:
            course_badge = f'<div style="margin-bottom:6px"><span style="font-size:14px;color:#6b7280">Môn học:</span><span style="background-color:#eff6ff;color:#2563eb;font-size:12px;font-weight:600;border-radius:6px;padding:3px 8px;margin-left:4px;display:inline-block">{course_code}</span></div>'
        elif course_name:
            course_badge = f'<div style="margin-bottom:6px"><span style="font-size:14px;color:#6b7280">Môn học:</span><span style="background-color:#eff6ff;color:#2563eb;font-size:12px;font-weight:600;border-radius:6px;padding:3px 8px;margin-left:4px;display:inline-block">{course_name}</span></div>'

        due_color = "#4b5563"
        if dl.due_at - now < timedelta(hours=24):
            due_color = "#ef4444"
            due_text = "Hôm nay / Sắp hết hạn (" + due_text + ")"

        due_row = f'<div><span style="font-size:14px;color:#6b7280">Hạn chót:</span><span style="font-size:14px;color:{due_color};font-weight:600;margin-left:4px">{due_text}</span></div>'

        html_msg = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UIT EduAdvisor - Nhắc nhở hạn nộp bài tập</title>
</head>
<body style="background-color: #f9fafb; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #1f2937;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 24px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
            <h2 style="font-size: 20px; font-weight: bold; color: #111827; margin: 0;">UIT EduAdvisor</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">Bạn có bài tập sắp hết hạn cần hoàn thành</p>
        </div>
        <div style="border-radius:12px;border:1px solid #e5e7eb;background-color:#ffffff;padding:20px;margin-bottom:16px">
            <div style="display:flex;margin-bottom:12px">
                <div style="margin-right:12px;display:inline-flex;height:18px;width:18px;border-radius:6px;border:1.5px solid #d1d5db;background-color:#f9fafb"></div>
                <p style="margin:0;font-size:16px;font-weight:500;color:#1f2937;line-height:1.4">
                    {dl.title}
                </p>
            </div>
            <div style="padding-left:30px;margin-top:8px">
                {course_badge}
                {due_row}
            </div>
        </div>
    </div>
</body>
</html>"""

        for acct in accounts:
            msg_to_send = html_msg if acct.platform == "mail" else plain_msg
            ok = await sender.send_message(acct.platform, acct.platform_user_id, msg_to_send)
            if ok:
                sent += 1
            else:
                logger.warning(
                    "reminder_send_failed",
                    extra={
                        "platform": acct.platform,
                        "student_id": str(dl.student_id),
                        "deadline_id": dl.id,
                    },
                )

    return sent

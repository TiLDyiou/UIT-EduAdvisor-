"""Reminder checker: scan upcoming exams/deadlines and send notifications."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.models.academic import Deadline, Exam
from app.db.models.bot import BotAccount, ReminderPreference
from app.services.bot.platform_sender import PlatformSender

logger = logging.getLogger(__name__)


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
    sent += await _send_deadline_reminders(db, redis, sender, settings.reminder_deadline_hours_before)
    return sent


async def _send_exam_reminders(
    db: AsyncSession,
    redis: Redis,
    sender: PlatformSender,
    hours_before: int,
) -> int:
    now = datetime.now(timezone.utc)
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
        already_sent = await redis.set(dedup_key, "1", nx=True, ex=48 * 3600)
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
        msg = (
            f"Nhac nho lich thi:\n"
            f"  Mon: {course_name}\n"
            f"  Ngay: {exam.exam_date.strftime('%d/%m/%Y')}\n"
            f"  Gio: {exam.start_time.strftime('%H:%M')}-{exam.end_time.strftime('%H:%M')}"
        )
        if exam.room:
            msg += f"\n  Phong: {exam.room}"

        for acct in accounts:
            ok = await sender.send_message(acct.platform, acct.platform_user_id, msg)
            if ok:
                sent += 1
            else:
                logger.warning("reminder_send_failed", extra={
                    "platform": acct.platform,
                    "student_id": str(exam.student_id),
                    "exam_id": exam.id,
                })

    return sent


async def _send_deadline_reminders(
    db: AsyncSession,
    redis: Redis,
    sender: PlatformSender,
    hours_before: int,
) -> int:
    now = datetime.now(timezone.utc)
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
        already_sent = await redis.set(dedup_key, "1", nx=True, ex=48 * 3600)
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
        prefix = f"[{course_name}] " if course_name else ""
        msg = (
            f"Nhac nho deadline:\n"
            f"  {prefix}{dl.title}\n"
            f"  Han: {dl.due_at.strftime('%d/%m/%Y %H:%M')}"
        )

        for acct in accounts:
            ok = await sender.send_message(acct.platform, acct.platform_user_id, msg)
            if ok:
                sent += 1
            else:
                logger.warning("reminder_send_failed", extra={
                    "platform": acct.platform,
                    "student_id": str(dl.student_id),
                    "deadline_id": dl.id,
                })

    return sent

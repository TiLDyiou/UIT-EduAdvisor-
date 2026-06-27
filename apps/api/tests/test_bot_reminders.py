"""Tests for reminder dedup and delivery logic."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta

import pytest

from app.db.models.academic import Deadline, Exam
from app.db.models.bot import BotAccount, ReminderPreference
from app.services.bot.bot_reminders import check_and_send_reminders
from app.services.bot.mock_sender import MockPlatformSender


@pytest.fixture
def student_id():
    return uuid.uuid4()


@pytest.fixture
def sender():
    return MockPlatformSender()


class TestExamReminders:
    async def test_sends_for_upcoming(
        self, db, redis, student_id, create_student, create_course, sender
    ):
        await create_student(student_id)
        course = await create_course("CS200", "ML")
        db.add(
            BotAccount(
                student_id=student_id,
                platform="discord",
                platform_user_id="r1",
                linked_at=datetime.now(UTC),
            )
        )
        db.add(
            ReminderPreference(student_id=student_id, exam_reminder=True, deadline_reminder=True)
        )
        db.add(
            Exam(
                student_id=student_id,
                course_id=course.id,
                term_code="2025-1",
                exam_date=date.today() + timedelta(days=1),
                start_time=time(8, 0),
                end_time=time(10, 0),
                room="A1",
            )
        )
        await db.flush()
        sent = await check_and_send_reminders(db, redis, sender)
        assert sent >= 1

    async def test_no_send_pref_off(
        self, db, redis, student_id, create_student, create_course, sender
    ):
        await create_student(student_id)
        course = await create_course("CS201", "AI")
        db.add(
            BotAccount(
                student_id=student_id,
                platform="discord",
                platform_user_id="r2",
                linked_at=datetime.now(UTC),
            )
        )
        db.add(
            ReminderPreference(student_id=student_id, exam_reminder=False, deadline_reminder=True)
        )
        db.add(
            Exam(
                student_id=student_id,
                course_id=course.id,
                term_code="2025-1",
                exam_date=date.today() + timedelta(days=1),
                start_time=time(8, 0),
                end_time=time(10, 0),
            )
        )
        await db.flush()
        sent = await check_and_send_reminders(db, redis, sender)
        assert sent == 0

    async def test_dedup(self, db, redis, student_id, create_student, create_course, sender):
        await create_student(student_id)
        course = await create_course("CS202", "DL")
        db.add(
            BotAccount(
                student_id=student_id,
                platform="discord",
                platform_user_id="r3",
                linked_at=datetime.now(UTC),
            )
        )
        db.add(
            ReminderPreference(student_id=student_id, exam_reminder=True, deadline_reminder=True)
        )
        db.add(
            Exam(
                student_id=student_id,
                course_id=course.id,
                term_code="2025-1",
                exam_date=date.today() + timedelta(days=1),
                start_time=time(8, 0),
                end_time=time(10, 0),
            )
        )
        await db.flush()
        sent1 = await check_and_send_reminders(db, redis, sender)
        sent2 = await check_and_send_reminders(db, redis, sender)
        assert sent1 >= 1
        assert sent2 == 0


class TestDeadlineReminders:
    async def test_sends_upcoming(
        self, db, redis, student_id, create_student, create_course, sender
    ):
        await create_student(student_id)
        course = await create_course("CS203", "SE")
        db.add(
            BotAccount(
                student_id=student_id,
                platform="discord",
                platform_user_id="r4",
                linked_at=datetime.now(UTC),
            )
        )
        db.add(
            ReminderPreference(student_id=student_id, exam_reminder=True, deadline_reminder=True)
        )
        db.add(
            Deadline(
                student_id=student_id,
                course_id=course.id,
                title="HW1",
                due_at=datetime.now(UTC) + timedelta(hours=12),
                source="moodle",
            )
        )
        await db.flush()
        sent = await check_and_send_reminders(db, redis, sender)
        assert sent >= 1

    async def test_no_send_past(self, db, redis, student_id, create_student, create_course, sender):
        await create_student(student_id)
        course = await create_course("CS204", "WD")
        db.add(
            BotAccount(
                student_id=student_id,
                platform="discord",
                platform_user_id="r5",
                linked_at=datetime.now(UTC),
            )
        )
        db.add(
            ReminderPreference(student_id=student_id, exam_reminder=True, deadline_reminder=True)
        )
        db.add(
            Deadline(
                student_id=student_id,
                course_id=course.id,
                title="HW2",
                due_at=datetime.now(UTC) - timedelta(hours=1),
                source="moodle",
            )
        )
        await db.flush()
        sent = await check_and_send_reminders(db, redis, sender)
        assert sent == 0

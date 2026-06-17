"""Tests for bot command dispatcher."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.academic import Course, Deadline, Enrollment, Exam, Schedule
from app.db.models.bot import BotAccount, ReminderPreference
from app.schemas.bot import NormalizedCommand
from app.services.bot.bot_commands import dispatch_command


@pytest.fixture
def student_id():
    return uuid.uuid4()


async def _link_student(db: AsyncSession, student_id: uuid.UUID, platform: str = "telegram", puid: str = "tg_test"):
    """Helper: create a BotAccount for testing."""
    acct = BotAccount(
        student_id=student_id,
        platform=platform,
        platform_user_id=puid,
        linked_at=datetime.now(timezone.utc),
    )
    db.add(acct)
    await db.flush()
    return acct


class TestPublicCommands:
    async def test_help(self, db: AsyncSession):
        cmd = NormalizedCommand(platform="telegram", platform_user_id="unknown", command="/help")
        result = await dispatch_command(db, cmd)
        assert "/tkb" in result
        assert "/gpa" in result
        assert "/nhacnho" in result

    async def test_start_unlinked(self, db: AsyncSession):
        cmd = NormalizedCommand(platform="telegram", platform_user_id="unknown", command="/start")
        result = await dispatch_command(db, cmd)
        assert "lien ket" in result.lower()

    async def test_start_already_linked(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        await _link_student(db, student_id, puid="tg_linked")
        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_linked", command="/start")
        result = await dispatch_command(db, cmd)
        assert "da lien ket" in result.lower()

    async def test_start_with_invalid_token(self, db: AsyncSession):
        cmd = NormalizedCommand(platform="telegram", platform_user_id="unknown", command="/start", args="not-a-uuid")
        result = await dispatch_command(db, cmd)
        assert "khong hop le" in result.lower()

    async def test_invalid_command(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        await _link_student(db, student_id, puid="tg_inv")
        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_inv", command="/xyz")
        result = await dispatch_command(db, cmd)
        assert "khong hop le" in result.lower()


class TestLinkedCommands:
    async def test_unlinked_user_gets_guide(self, db: AsyncSession):
        cmd = NormalizedCommand(platform="telegram", platform_user_id="no_link", command="/tkb")
        result = await dispatch_command(db, cmd)
        assert "chua duoc lien ket" in result.lower()

    async def test_tkb_no_data(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        await _link_student(db, student_id, puid="tg_tkb")
        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_tkb", command="/tkb")
        result = await dispatch_command(db, cmd)
        assert "chua co" in result.lower()

    async def test_tkb_with_data(self, db: AsyncSession, student_id, create_student, create_course):
        await create_student(student_id)
        course = await create_course("CS101", "Intro CS")
        await _link_student(db, student_id, puid="tg_tkb2")

        sch = Schedule(
            student_id=student_id,
            course_id=course.id,
            term_code="2025-1",
            day_of_week=2,
            start_period=1,
            end_period=3,
            room="A101",
        )
        db.add(sch)
        await db.flush()

        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_tkb2", command="/tkb")
        result = await dispatch_command(db, cmd)
        assert "Intro CS" in result
        assert "A101" in result

    async def test_tkb_day_filter(self, db: AsyncSession, student_id, create_student, create_course):
        await create_student(student_id)
        course = await create_course("CS102", "Algo")
        await _link_student(db, student_id, puid="tg_tkb3")

        sch = Schedule(
            student_id=student_id,
            course_id=course.id,
            term_code="2025-1",
            day_of_week=4,
            start_period=6,
            end_period=8,
            room="B202",
        )
        db.add(sch)
        await db.flush()

        # Filter matching day
        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_tkb3", command="/tkb", args="thu4")
        result = await dispatch_command(db, cmd)
        assert "Algo" in result

        # Filter non-matching day
        cmd2 = NormalizedCommand(platform="telegram", platform_user_id="tg_tkb3", command="/tkb", args="thu2")
        result2 = await dispatch_command(db, cmd2)
        assert "khong co" in result2.lower()

    async def test_lithi_no_exams(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        await _link_student(db, student_id, puid="tg_lithi")
        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_lithi", command="/lithi")
        result = await dispatch_command(db, cmd)
        assert "khong co" in result.lower()

    async def test_lithi_with_exam(self, db: AsyncSession, student_id, create_student, create_course):
        await create_student(student_id)
        course = await create_course("CS103", "DB")
        await _link_student(db, student_id, puid="tg_lithi2")

        exam = Exam(
            student_id=student_id,
            course_id=course.id,
            term_code="2025-1",
            exam_date=date.today() + timedelta(days=2),
            start_time=time(8, 0),
            end_time=time(10, 0),
            room="E301",
        )
        db.add(exam)
        await db.flush()

        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_lithi2", command="/lithi")
        result = await dispatch_command(db, cmd)
        assert "DB" in result
        assert "E301" in result

    async def test_deadline(self, db: AsyncSession, student_id, create_student, create_course):
        await create_student(student_id)
        course = await create_course("CS104", "OS")
        await _link_student(db, student_id, puid="tg_dl")

        dl = Deadline(
            student_id=student_id,
            course_id=course.id,
            title="Bai tap 1",
            due_at=datetime.now(timezone.utc) + timedelta(days=3),
            source="moodle",
        )
        db.add(dl)
        await db.flush()

        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_dl", command="/deadline")
        result = await dispatch_command(db, cmd)
        assert "Bai tap 1" in result

    async def test_gpa_no_data(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        await _link_student(db, student_id, puid="tg_gpa")
        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_gpa", command="/gpa")
        result = await dispatch_command(db, cmd)
        assert "chua co" in result.lower()

    async def test_gpa_with_data(self, db: AsyncSession, student_id, create_student, create_course):
        await create_student(student_id)
        course = await create_course("CS105", "Net")
        await _link_student(db, student_id, puid="tg_gpa2")

        enroll = Enrollment(
            student_id=student_id,
            course_id=course.id,
            term_code="2025-1",
            status="passed",
            final_grade_10=Decimal("8.5"),
        )
        db.add(enroll)
        await db.flush()

        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_gpa2", command="/gpa")
        result = await dispatch_command(db, cmd)
        assert "8.5" in result


class TestNhacnhoCommand:
    async def test_nhacnho_status_default(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        await _link_student(db, student_id, puid="tg_nh")
        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_nh", command="/nhacnho", args="status")
        result = await dispatch_command(db, cmd)
        assert "BAT" in result

    async def test_nhacnho_toggle_off(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        await _link_student(db, student_id, puid="tg_nh2")
        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_nh2", command="/nhacnho", args="thi off")
        result = await dispatch_command(db, cmd)
        assert "tat" in result.lower()

    async def test_nhacnho_invalid_syntax(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        await _link_student(db, student_id, puid="tg_nh3")
        cmd = NormalizedCommand(platform="telegram", platform_user_id="tg_nh3", command="/nhacnho", args="xyz")
        result = await dispatch_command(db, cmd)
        assert "cu phap" in result.lower()

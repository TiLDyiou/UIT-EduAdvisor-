"""Tests for bot identity linking service."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bot import BotAccount, LinkToken, ReminderPreference
from app.services.bot.bot_linking import (
    create_link_token,
    find_student_by_platform,
    get_linked_accounts,
    redeem_link_token,
    unlink_account,
)


@pytest.fixture
def student_id():
    return uuid.uuid4()


class TestCreateLinkToken:
    async def test_creates_token(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "telegram")
        assert lt.platform == "telegram"
        assert lt.student_id == student_id
        assert lt.token is not None
        assert lt.expires_at > datetime.now(timezone.utc)

    async def test_token_expires_in_future(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "discord")
        # Default TTL is 600 seconds
        delta = lt.expires_at - datetime.now(timezone.utc)
        assert 590 < delta.total_seconds() <= 610


class TestRedeemLinkToken:
    async def test_redeem_success(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "telegram")
        await db.flush()

        acct = await redeem_link_token(db, lt.token, "tg_user_123")
        assert acct is not None
        assert acct.platform == "telegram"
        assert acct.platform_user_id == "tg_user_123"
        assert acct.student_id == student_id

    async def test_redeem_creates_reminder_preference(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "telegram")
        await db.flush()
        await redeem_link_token(db, lt.token, "tg_user_456")

        res = await db.execute(
            select(ReminderPreference).where(ReminderPreference.student_id == student_id)
        )
        pref = res.scalar_one_or_none()
        assert pref is not None
        assert pref.exam_reminder is True
        assert pref.deadline_reminder is True

    async def test_redeem_expired_token(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "telegram")
        lt.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        await db.flush()

        acct = await redeem_link_token(db, lt.token, "tg_user_789")
        assert acct is None

    async def test_redeem_used_token(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "telegram")
        await db.flush()

        acct1 = await redeem_link_token(db, lt.token, "tg_user_aaa")
        assert acct1 is not None

        acct2 = await redeem_link_token(db, lt.token, "tg_user_bbb")
        assert acct2 is None

    async def test_redeem_nonexistent_token(self, db: AsyncSession):
        acct = await redeem_link_token(db, uuid.uuid4(), "tg_user_xxx")
        assert acct is None

    async def test_relink_deactivates_old_account(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)

        # First link
        lt1 = await create_link_token(db, student_id, "telegram")
        await db.flush()
        await redeem_link_token(db, lt1.token, "tg_old_user")
        await db.flush()

        # Second link (new platform_user_id)
        lt2 = await create_link_token(db, student_id, "telegram")
        await db.flush()
        await redeem_link_token(db, lt2.token, "tg_new_user")
        await db.flush()

        # Old account should be unlinked
        res = await db.execute(
            select(BotAccount).where(
                BotAccount.platform_user_id == "tg_old_user",
                BotAccount.unlinked_at.is_(None),
            )
        )
        assert res.scalar_one_or_none() is None


class TestFindStudentByPlatform:
    async def test_find_linked(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "telegram")
        await db.flush()
        await redeem_link_token(db, lt.token, "tg_find_user")
        await db.flush()

        student = await find_student_by_platform(db, "telegram", "tg_find_user")
        assert student is not None
        assert student.id == student_id

    async def test_find_unlinked_returns_none(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "telegram")
        await db.flush()
        await redeem_link_token(db, lt.token, "tg_unlink_user")
        await db.flush()
        await unlink_account(db, student_id, "telegram")
        await db.flush()

        student = await find_student_by_platform(db, "telegram", "tg_unlink_user")
        assert student is None

    async def test_find_wrong_platform(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "telegram")
        await db.flush()
        await redeem_link_token(db, lt.token, "tg_wrong_plat")
        await db.flush()

        student = await find_student_by_platform(db, "discord", "tg_wrong_plat")
        assert student is None


class TestUnlinkAccount:
    async def test_unlink_existing(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        lt = await create_link_token(db, student_id, "telegram")
        await db.flush()
        await redeem_link_token(db, lt.token, "tg_to_unlink")
        await db.flush()

        result = await unlink_account(db, student_id, "telegram")
        assert result is True

    async def test_unlink_nonexistent(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)
        result = await unlink_account(db, student_id, "telegram")
        assert result is False


class TestGetLinkedAccounts:
    async def test_list_active(self, db: AsyncSession, student_id, create_student):
        await create_student(student_id)

        lt1 = await create_link_token(db, student_id, "telegram")
        await db.flush()
        await redeem_link_token(db, lt1.token, "tg_list_user")
        await db.flush()

        lt2 = await create_link_token(db, student_id, "discord")
        await db.flush()
        await redeem_link_token(db, lt2.token, "dc_list_user")
        await db.flush()

        accounts = await get_linked_accounts(db, student_id)
        assert len(accounts) == 2
        platforms = {a.platform for a in accounts}
        assert platforms == {"telegram", "discord"}

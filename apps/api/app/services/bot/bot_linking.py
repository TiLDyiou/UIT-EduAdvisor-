"""Identity linking: create/redeem link tokens, manage bot accounts."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models.bot import BotAccount, LinkToken, ReminderPreference
from app.db.models.core_security import Student


async def create_link_token(
    db: AsyncSession,
    student_id: uuid.UUID,
    platform: str,
) -> LinkToken:
    settings = get_settings()
    now = datetime.now(UTC)
    token = LinkToken(
        student_id=student_id,
        platform=platform,
        token=uuid.uuid4(),
        expires_at=now + timedelta(seconds=settings.bot_link_token_ttl_seconds),
    )
    db.add(token)
    await db.flush()
    return token


async def redeem_link_token(
    db: AsyncSession,
    token_uuid: uuid.UUID,
    platform_user_id: str,
) -> BotAccount | None:
    """Validate and consume a link token, creating or reactivating a BotAccount.

    Returns None if token is invalid, expired, or already used.
    """
    now = datetime.now(UTC)
    res = await db.execute(
        select(LinkToken)
        .where(
            LinkToken.token == token_uuid,
            LinkToken.used_at.is_(None),
            LinkToken.expires_at > now,
        )
        .limit(1)
    )
    lt = res.scalar_one_or_none()
    if lt is None:
        return None

    lt.used_at = now

    # Deactivate any existing account for this platform_user_id on the same platform
    await db.execute(
        update(BotAccount)
        .where(
            BotAccount.platform == lt.platform,
            BotAccount.platform_user_id == platform_user_id,
            BotAccount.unlinked_at.is_(None),
        )
        .values(unlinked_at=now)
    )

    # Deactivate any existing account for this student on the same platform
    await db.execute(
        update(BotAccount)
        .where(
            BotAccount.student_id == lt.student_id,
            BotAccount.platform == lt.platform,
            BotAccount.unlinked_at.is_(None),
        )
        .values(unlinked_at=now)
    )

    account = BotAccount(
        student_id=lt.student_id,
        platform=lt.platform,
        platform_user_id=platform_user_id,
        linked_at=now,
    )
    db.add(account)

    # Ensure reminder preferences exist
    pref_res = await db.execute(
        select(ReminderPreference).where(ReminderPreference.student_id == lt.student_id).limit(1)
    )
    if pref_res.scalar_one_or_none() is None:
        db.add(ReminderPreference(student_id=lt.student_id))

    await db.flush()
    return account


async def find_student_by_platform(
    db: AsyncSession,
    platform: str,
    platform_user_id: str,
) -> Student | None:
    """Look up student from a linked (not unlinked) bot account."""
    res = await db.execute(
        select(Student)
        .join(BotAccount, BotAccount.student_id == Student.id)
        .where(
            BotAccount.platform == platform,
            BotAccount.platform_user_id == platform_user_id,
            BotAccount.unlinked_at.is_(None),
        )
        .limit(1)
    )
    return res.scalar_one_or_none()


async def unlink_account(
    db: AsyncSession,
    student_id: uuid.UUID,
    platform: str,
) -> bool:
    """Unlink a bot account (hard delete). Returns True if the account existed."""
    from sqlalchemy import delete
    result = await db.execute(
        delete(BotAccount)
        .where(
            BotAccount.student_id == student_id,
            BotAccount.platform == platform,
        )
    )
    return result.rowcount > 0


async def get_linked_accounts(
    db: AsyncSession,
    student_id: uuid.UUID,
) -> list[BotAccount]:
    """Return all active (not unlinked) bot accounts for a student."""
    res = await db.execute(
        select(BotAccount)
        .where(
            BotAccount.student_id == student_id,
            BotAccount.unlinked_at.is_(None),
        )
        .order_by(BotAccount.linked_at.desc())
    )
    return list(res.scalars().all())


async def get_all_bot_accounts(
    db: AsyncSession,
    student_id: uuid.UUID,
) -> list[BotAccount]:
    """Return the latest bot accounts (active or unlinked) for each platform."""
    res = await db.execute(
        select(BotAccount)
        .where(BotAccount.student_id == student_id)
        .order_by(BotAccount.linked_at.desc())
    )
    accounts = list(res.scalars().all())
    # Lọc chỉ lấy tài khoản mới nhất cho mỗi nền tảng (platform)
    seen = set()
    latest_accounts = []
    for a in accounts:
        if a.platform not in seen:
            seen.add(a.platform)
            latest_accounts.append(a)
    return latest_accounts

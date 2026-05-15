"""Student-facing bot linking and reminder preference endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.models.bot import ReminderPreference
from app.db.models.core_security import Student
from app.deps import get_current_student, get_db, get_settings_dep, require_csrf
from app.schemas.bot import (
    BotAccountResponse,
    LinkTokenCreateRequest,
    LinkTokenResponse,
    ReminderPreferenceResponse,
    ReminderPreferenceUpdateRequest,
)
from app.services.bot.bot_linking import (
    create_link_token,
    get_linked_accounts,
    unlink_account,
)

router = APIRouter(prefix="/bot", tags=["bot-link"])


def _build_deep_link(platform: str, token: str, settings: Settings) -> str:
    """Build platform-specific deep link for bot linking.

    # MOCK_API: BOT_USERNAME and PAGE_NAME are placeholders when tokens are not set.
    # See docs/M7_BOT_INTEGRATION_GUIDE.md
    """
    if platform == "telegram":
        username = settings.telegram_bot_username or "YOUR_BOT_USERNAME"
        return f"https://t.me/{username}?start={token}"
    if platform == "discord":
        return f"Gui lenh trong server Discord: /link {token}"
    if platform == "messenger":
        page_name = settings.messenger_page_name or "YOUR_PAGE_NAME"
        return f"https://m.me/{page_name}?ref={token}"
    return token


@router.post("/link-token", response_model=LinkTokenResponse)
async def create_bot_link_token(
    body: LinkTokenCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    _: Annotated[None, Depends(require_csrf)],
) -> LinkTokenResponse:
    lt = await create_link_token(db, student.id, body.platform)
    await db.commit()
    return LinkTokenResponse(
        token=str(lt.token),
        expires_at=lt.expires_at,
        deep_link=_build_deep_link(body.platform, str(lt.token), settings),
    )


@router.get("/accounts", response_model=list[BotAccountResponse])
async def list_bot_accounts(
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
) -> list[BotAccountResponse]:
    accounts = await get_linked_accounts(db, student.id)
    return [
        BotAccountResponse(
            platform=a.platform,
            platform_user_id=a.platform_user_id,
            linked_at=a.linked_at,
        )
        for a in accounts
    ]


@router.delete("/accounts/{platform}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_bot_account(
    platform: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
):
    if platform not in ("telegram", "discord", "messenger"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_platform")
    found = await unlink_account(db, student.id, platform)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="account_not_linked")
    await db.commit()


@router.get("/reminders", response_model=ReminderPreferenceResponse)
async def get_reminder_prefs(
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
) -> ReminderPreferenceResponse:
    res = await db.execute(
        select(ReminderPreference).where(ReminderPreference.student_id == student.id).limit(1)
    )
    pref = res.scalar_one_or_none()
    return ReminderPreferenceResponse(
        exam_reminder=pref.exam_reminder if pref else True,
        deadline_reminder=pref.deadline_reminder if pref else True,
    )


@router.put("/reminders", response_model=ReminderPreferenceResponse)
async def update_reminder_prefs(
    body: ReminderPreferenceUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
) -> ReminderPreferenceResponse:
    res = await db.execute(
        select(ReminderPreference).where(ReminderPreference.student_id == student.id).limit(1)
    )
    pref = res.scalar_one_or_none()
    if pref is None:
        pref = ReminderPreference(student_id=student.id)
        db.add(pref)
    pref.exam_reminder = body.exam_reminder
    pref.deadline_reminder = body.deadline_reminder
    await db.flush()
    await db.commit()
    return ReminderPreferenceResponse(
        exam_reminder=pref.exam_reminder,
        deadline_reminder=pref.deadline_reminder,
    )

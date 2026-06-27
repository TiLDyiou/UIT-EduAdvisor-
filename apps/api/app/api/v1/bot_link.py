"""Student-facing bot linking and reminder preference endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core.config import Settings
from app.db.models.bot import BotAccount, ReminderPreference
from app.db.models.core_security import Student
from app.deps import get_current_student, get_db, get_settings_dep, require_csrf, get_redis
from redis.asyncio import Redis
from app.services.bot.real_sender import get_platform_sender
from app.schemas.bot import (
    BotAccountResponse,
    LinkTokenCreateRequest,
    LinkTokenResponse,
    ReminderPreferenceResponse,
    ReminderPreferenceUpdateRequest,
)
from app.services.bot.bot_linking import (
    create_link_token,
    unlink_account,
    get_all_bot_accounts,
)

router = APIRouter(prefix="/bot", tags=["bot-link"])

async def get_discord_username(user_id: str, redis: Redis, settings: Settings) -> str | None:
    cache_key = f"discord_username:{user_id}"
    cached = await redis.get(cache_key)
    if cached:
        return cached if isinstance(cached, str) else cached.decode("utf-8")
    
    if not settings.discord_bot_token:
        return None
        
    try:
        headers = {"Authorization": f"Bot {settings.discord_bot_token}"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://discord.com/api/v10/users/{user_id}", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                name = data.get("global_name") or data.get("username")
                if name:
                    await redis.setex(cache_key, 86400, name)
                    return name
    except Exception:
        pass
    
    return None


def _build_deep_link(platform: str, token: str, settings: Settings) -> str:
    """Build platform-specific deep link for bot linking.

    # MOCK_API: BOT_USERNAME and PAGE_NAME are placeholders when tokens are not set.
    # See docs/M7_BOT_INTEGRATION_GUIDE.md
    """
    if platform == "discord":
        return f"Gui lenh trong server Discord: /link {token}"
    if platform == "mail":
        return "Vui lòng cấu hình nhận thông báo qua email."
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
    redis: Annotated[Redis, Depends(get_redis)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> list[BotAccountResponse]:
    accounts = await get_all_bot_accounts(db, student.id)
    out = []
    for a in accounts:
        username = None
        if a.platform == "discord":
            username = await get_discord_username(a.platform_user_id, redis, settings)
            
        out.append(
            BotAccountResponse(
                platform=a.platform,
                platform_user_id=a.platform_user_id,
                platform_username=username,
                linked_at=a.linked_at,
                unlinked_at=a.unlinked_at,
            )
        )
    return out


@router.delete("/accounts/{platform}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_bot_account(
    platform: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
):
    if platform not in ("discord", "mail"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_platform")
    found = await unlink_account(db, student.id, platform)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="account_not_linked")
    await db.commit()


@router.post("/accounts/{platform}/reactivate", status_code=status.HTTP_200_OK)
async def reactivate_bot_account(
    platform: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    _: Annotated[None, Depends(require_csrf)],
):
    if platform not in ("discord", "mail"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_platform")

    # Tìm tài khoản đã hủy liên kết gần nhất
    res = await db.execute(
        select(BotAccount)
        .where(
            BotAccount.student_id == student.id,
            BotAccount.platform == platform,
            BotAccount.unlinked_at.is_not(None),
        )
        .order_by(BotAccount.linked_at.desc())
        .limit(1)
    )
    account = res.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="no_unlinked_account_found"
        )

    account.unlinked_at = None
    account.linked_at = datetime.now(UTC)
    await db.commit()

    sender = get_platform_sender(settings)
    message = "**Thông báo:** Kênh nhận thông báo này đã được **Bật (Active)** trở lại."
    await sender.send_message(platform, account.platform_user_id, message)

    return {"ok": True}


@router.post("/accounts/{platform}/deactivate", status_code=status.HTTP_200_OK)
async def deactivate_bot_account(
    platform: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    _: Annotated[None, Depends(require_csrf)],
):
    if platform not in ("discord", "mail"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_platform")

    # Tìm tài khoản đang hoạt động của học sinh
    res = await db.execute(
        select(BotAccount)
        .where(
            BotAccount.student_id == student.id,
            BotAccount.platform == platform,
            BotAccount.unlinked_at.is_(None),
        )
        .limit(1)
    )
    account = res.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="account_not_linked")

    account.unlinked_at = datetime.now(UTC)
    await db.commit()

    sender = get_platform_sender(settings)
    message = "**Thông báo:** Kênh nhận thông báo này đã bị **Tạm ngưng (Inactive)** từ trang web. Bạn sẽ không nhận được nhắc nhở qua đây nữa.\n\n_Bạn có thể bật lại trong phần Cài đặt hệ thống._"
    await sender.send_message(platform, account.platform_user_id, message)

    return {"ok": True}


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


class EmailLinkRequest(BaseModel):
    email: str


class EmailVerifyRequest(BaseModel):
    email: str
    otp: str


@router.post("/email/request-otp", status_code=status.HTTP_200_OK)
async def request_email_otp(
    body: EmailLinkRequest,
    redis: Annotated[Redis, Depends(get_redis)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
):
    import re
    import random

    if not re.match(r"[^@]+@[^@]+\.[^@]+", body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_email")

    email = body.email.strip().lower()
    otp = f"{random.randint(0, 999999):06d}"

    # Save OTP to Redis with 5 minutes TTL
    key = f"email_otp:{student.id}:{email}"
    await redis.setex(key, 300, otp)

    # Send OTP email
    sender = get_platform_sender(settings)
    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UIT EduAdvisor - Xác nhận liên kết Email</title>
</head>
<body style="background-color: #f9fafb; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #1f2937;">
    <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 32px; border: 1px solid #e5e7eb;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6;">
            <h2 style="font-size: 22px; font-weight: bold; color: #111827; margin: 0;">UIT EduAdvisor</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 6px 0 0 0;">Liên kết địa chỉ Email để nhận thông báo tự động</p>
        </div>
        <div style="margin-bottom: 24px; text-align: center;">
            <p style="font-size: 15px; color: #4b5563; line-height: 1.5; margin: 0 0 20px 0;">
                Bạn đã yêu cầu liên kết địa chỉ email này với tài khoản học sinh tại UIT EduAdvisor. Vui lòng sử dụng mã OTP dưới đây để xác nhận:
            </p>
            <div style="background-color: #f3f4f6; border-radius: 12px; padding: 16px 24px; display: inline-block; margin-bottom: 20px;">
                <span style="font-family: monospace; font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 4px;">{otp}</span>
            </div>
            <p style="font-size: 13px; color: #9ca3af; margin: 0;">
                Mã xác nhận này sẽ hết hạn sau <strong>5 phút</strong>. Nếu không phải bạn yêu cầu, vui lòng bỏ qua email này.
            </p>
        </div>
        <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                Đây là email tự động, vui lòng không phản hồi email này.
            </p>
        </div>
    </div>
</body>
</html>"""
    success = await sender.send_message("mail", email, html_content)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="send_email_failed"
        )

    return {"ok": True}


@router.post("/email/link", status_code=status.HTTP_200_OK)
async def link_email_account(
    body: EmailVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
):
    import re
    from datetime import datetime
    from sqlalchemy import update

    if not re.match(r"[^@]+@[^@]+\.[^@]+", body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_email")

    email = body.email.strip().lower()
    key = f"email_otp:{student.id}:{email}"
    stored_otp = await redis.get(key)

    if not stored_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_or_expired_otp"
        )

    otp_str = stored_otp if isinstance(stored_otp, str) else stored_otp.decode("utf-8")
    if otp_str != body.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_or_expired_otp"
        )

    # OTP is valid, delete it
    await redis.delete(key)

    now = datetime.now(UTC)

    # Unlink any existing mail account for this student
    await db.execute(
        update(BotAccount)
        .where(
            BotAccount.student_id == student.id,
            BotAccount.platform == "mail",
            BotAccount.unlinked_at.is_(None),
        )
        .values(unlinked_at=now)
    )

    # Check if the requested email is already in DB
    existing_res = await db.execute(
        select(BotAccount)
        .where(BotAccount.platform == "mail", BotAccount.platform_user_id == email)
        .limit(1)
    )
    existing_account = existing_res.scalar_one_or_none()

    if existing_account:
        if existing_account.student_id != student.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="email_in_use_by_other_student"
            )

        existing_account.unlinked_at = None
        existing_account.linked_at = now
    else:
        account = BotAccount(
            student_id=student.id,
            platform="mail",
            platform_user_id=email,
            linked_at=now,
        )
        db.add(account)

    # Ensure reminder preferences exist
    res = await db.execute(
        select(ReminderPreference).where(ReminderPreference.student_id == student.id).limit(1)
    )
    if res.scalar_one_or_none() is None:
        db.add(ReminderPreference(student_id=student.id))

    await db.commit()
    return {"ok": True}

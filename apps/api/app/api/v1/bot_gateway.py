"""Unified Bot Gateway: webhook endpoints for Telegram and Messenger.

# MOCK_API: Webhook validation is skipped when tokens are not set.
# See docs/M7_BOT_INTEGRATION_GUIDE.md for setting up real webhooks.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.rate_limit import RateLimiter
from app.deps import get_db, get_redis, get_settings_dep
from app.schemas.bot import NormalizedCommand
from app.services.bot.bot_commands import dispatch_command
from app.services.bot.real_sender import get_platform_sender

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bot", tags=["bot-gateway"])


# ---------------------------------------------------------------------------
# Telegram webhook
# ---------------------------------------------------------------------------

def _parse_telegram_update(payload: dict) -> NormalizedCommand | None:
    """Extract command from a Telegram Update JSON."""
    msg = payload.get("message") or payload.get("edited_message")
    if not msg:
        return None
    text = msg.get("text", "")
    chat = msg.get("chat", {})
    chat_id = str(chat.get("id", ""))
    if not chat_id or not text:
        return None

    # Parse /command args (strip @botname if present)
    if text.startswith("/"):
        parts = text.split(None, 1)
        command = parts[0].split("@")[0]
        args = parts[1] if len(parts) > 1 else ""
    else:
        command = ""
        args = text

    if not command:
        return None

    return NormalizedCommand(
        platform="telegram",
        platform_user_id=chat_id,
        command=command,
        args=args,
    )


@router.post("/telegram/webhook", status_code=status.HTTP_200_OK)
async def telegram_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> dict:
    body = await request.body()
    sender = get_platform_sender(settings)

    # Validate webhook secret
    headers = dict(request.headers)
    if not await sender.validate_webhook("telegram", headers, body):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid_signature")

    payload = await request.json()
    cmd = _parse_telegram_update(payload)
    if cmd is None:
        return {"ok": True}

    # Rate limit
    limiter = RateLimiter(redis)
    allowed, _, _ = await limiter.check(
        f"bot_cmd:{cmd.platform_user_id}", settings.bot_command_rate_limit_per_hour, 3600
    )
    if not allowed:
        await sender.send_message("telegram", cmd.platform_user_id, "Ban da gui qua nhieu lenh. Vui long cho.")
        return {"ok": True}

    response_text = await dispatch_command(db, cmd)
    await sender.send_message("telegram", cmd.platform_user_id, response_text)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Messenger webhook
# ---------------------------------------------------------------------------

def _parse_messenger_events(payload: dict) -> list[NormalizedCommand]:
    """Extract commands from Messenger webhook payload."""
    commands: list[NormalizedCommand] = []
    for entry in payload.get("entry", []):
        for event in entry.get("messaging", []):
            sender_id = event.get("sender", {}).get("id", "")
            if not sender_id:
                continue

            # Check for optin (ref-based linking)
            optin = event.get("optin", {})
            if optin and optin.get("ref"):
                commands.append(NormalizedCommand(
                    platform="messenger",
                    platform_user_id=sender_id,
                    command="/start",
                    args=optin["ref"],
                ))
                continue

            # Check for postback
            postback = event.get("postback", {})
            if postback:
                payload_text = postback.get("payload", "")
                if payload_text.startswith("/"):
                    parts = payload_text.split(None, 1)
                    commands.append(NormalizedCommand(
                        platform="messenger",
                        platform_user_id=sender_id,
                        command=parts[0],
                        args=parts[1] if len(parts) > 1 else "",
                    ))
                continue

            # Check for message text
            message = event.get("message", {})
            text = message.get("text", "").strip()
            if not text:
                continue

            # Check for referral in message (m.me link)
            referral = event.get("referral", {})
            if referral and referral.get("ref"):
                commands.append(NormalizedCommand(
                    platform="messenger",
                    platform_user_id=sender_id,
                    command="/start",
                    args=referral["ref"],
                ))
                continue

            if text.startswith("/"):
                parts = text.split(None, 1)
                commands.append(NormalizedCommand(
                    platform="messenger",
                    platform_user_id=sender_id,
                    command=parts[0],
                    args=parts[1] if len(parts) > 1 else "",
                ))

    return commands


@router.get("/messenger/webhook", status_code=status.HTTP_200_OK)
async def messenger_webhook_verify(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
) -> Response:
    """Facebook webhook verification challenge."""
    settings = get_settings()
    expected = settings.messenger_verify_token
    if hub_mode == "subscribe" and hub_verify_token == expected:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="verification_failed")


@router.post("/messenger/webhook", status_code=status.HTTP_200_OK)
async def messenger_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> dict:
    body = await request.body()
    sender = get_platform_sender(settings)

    headers = dict(request.headers)
    if not await sender.validate_webhook("messenger", headers, body):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid_signature")

    payload = await request.json()
    commands = _parse_messenger_events(payload)

    limiter = RateLimiter(redis)
    for cmd in commands:
        allowed, _, _ = await limiter.check(
            f"bot_cmd:{cmd.platform_user_id}", settings.bot_command_rate_limit_per_hour, 3600
        )
        if not allowed:
            await sender.send_message("messenger", cmd.platform_user_id, "Ban da gui qua nhieu lenh. Vui long cho.")
            continue

        response_text = await dispatch_command(db, cmd)
        await sender.send_message("messenger", cmd.platform_user_id, response_text)

    return {"ok": True}

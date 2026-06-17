"""Real platform sender: calls Telegram/Discord/Messenger APIs.

# MOCK_API: Each platform method falls back to MockPlatformSender if the
# corresponding token is empty. When you set tokens in .env, the real
# API calls activate automatically -- no code changes needed.
# See docs/M7_BOT_INTEGRATION_GUIDE.md
"""

from __future__ import annotations

import hashlib
import hmac
import logging

import httpx

from app.core.config import Settings
from app.services.bot.mock_sender import MockPlatformSender

logger = logging.getLogger(__name__)

_mock = MockPlatformSender()


class RealPlatformSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def send_message(self, platform: str, recipient_id: str, text: str) -> bool:
        if platform == "telegram":
            return await self._send_telegram(recipient_id, text)
        if platform == "discord":
            # Discord messages are sent via discord.py gateway, not HTTP.
            # This path is only used by the reminder worker which needs to
            # reach Discord users without the gateway. Uses webhook fallback.
            return await self._send_discord_dm(recipient_id, text)
        if platform == "messenger":
            return await self._send_messenger(recipient_id, text)
        logger.warning("unknown_platform", extra={"platform": platform})
        return False

    async def validate_webhook(self, platform: str, headers: dict, body: bytes) -> bool:
        if platform == "telegram":
            return self._validate_telegram(headers)
        if platform == "messenger":
            return self._validate_messenger(headers, body)
        return False

    # --- Telegram ---

    async def _send_telegram(self, chat_id: str, text: str) -> bool:
        token = self._settings.telegram_bot_token
        if not token:
            # MOCK_API: no token configured, fall back to mock
            return await _mock.send_message("telegram", chat_id, text)
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(url, json={"chat_id": chat_id, "text": text})
                if r.status_code == 200:
                    return True
                logger.warning("telegram_send_error", extra={"status": r.status_code, "body": r.text[:200]})
                return False
        except httpx.HTTPError as e:
            logger.error("telegram_send_exception", extra={"error": str(e)})
            return False

    def _validate_telegram(self, headers: dict) -> bool:
        secret = self._settings.telegram_webhook_secret
        if not secret:
            # MOCK_API: no secret configured, skip validation
            return True
        header_token = headers.get("x-telegram-bot-api-secret-token", "")
        return hmac.compare_digest(header_token, secret)

    # --- Messenger ---

    async def _send_messenger(self, recipient_id: str, text: str) -> bool:
        token = self._settings.messenger_page_access_token
        if not token:
            # MOCK_API: no token configured, fall back to mock
            return await _mock.send_message("messenger", recipient_id, text)
        url = "https://graph.facebook.com/v19.0/me/messages"
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": text},
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(url, json=payload, params={"access_token": token})
                if r.status_code == 200:
                    return True
                logger.warning("messenger_send_error", extra={"status": r.status_code, "body": r.text[:200]})
                return False
        except httpx.HTTPError as e:
            logger.error("messenger_send_exception", extra={"error": str(e)})
            return False

    def _validate_messenger(self, headers: dict, body: bytes) -> bool:
        app_secret = self._settings.messenger_app_secret
        if not app_secret:
            # MOCK_API: no secret configured, skip validation
            return True
        signature = headers.get("x-hub-signature-256", "")
        if not signature.startswith("sha256="):
            return False
        expected = hmac.new(
            app_secret.encode(), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature[7:], expected)

    # --- Discord (DM via HTTP API, used by reminder worker) ---

    async def _send_discord_dm(self, user_id: str, text: str) -> bool:
        token = self._settings.discord_bot_token
        if not token:
            # MOCK_API: no token configured, fall back to mock
            return await _mock.send_message("discord", user_id, text)
        headers = {"Authorization": f"Bot {token}", "Content-Type": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                # Step 1: Create DM channel
                r = await client.post(
                    "https://discord.com/api/v10/users/@me/channels",
                    headers=headers,
                    json={"recipient_id": user_id},
                )
                if r.status_code != 200:
                    logger.warning("discord_dm_create_error", extra={"status": r.status_code})
                    return False
                channel_id = r.json()["id"]
                # Step 2: Send message
                r = await client.post(
                    f"https://discord.com/api/v10/channels/{channel_id}/messages",
                    headers=headers,
                    json={"content": text},
                )
                return r.status_code == 200
        except httpx.HTTPError as e:
            logger.error("discord_dm_exception", extra={"error": str(e)})
            return False


def get_platform_sender(settings: Settings) -> MockPlatformSender | RealPlatformSender:
    """Factory: return real sender if any bot token is set, else mock.

    # MOCK_API: When all tokens in .env are empty, this returns MockPlatformSender.
    # Set any token to activate RealPlatformSender (which still falls back
    # to mock per-platform if that specific token is empty).
    """
    if (
        settings.telegram_bot_token
        or settings.discord_bot_token
        or settings.messenger_page_access_token
    ):
        return RealPlatformSender(settings)
    return MockPlatformSender()

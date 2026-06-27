"""Real platform sender: calls Discord APIs and sends emails.

# MOCK_API: Each platform method falls back to MockPlatformSender if the
# corresponding token is empty. When you set tokens in .env, the real
# API calls activate automatically -- no code changes needed.
# See docs/M7_BOT_INTEGRATION_GUIDE.md
"""

from __future__ import annotations

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
        if platform == "discord":
            # Discord messages are sent via discord.py gateway, not HTTP.
            # This path is only used by the reminder worker which needs to
            # reach Discord users without the gateway. Uses webhook fallback.
            return await self._send_discord_dm(recipient_id, text)
        if platform == "mail":
            return await self._send_mail(recipient_id, text)
        logger.warning("unknown_platform", extra={"platform": platform})
        return False

    async def validate_webhook(self, platform: str, headers: dict, body: bytes) -> bool:
        return False

    # --- Mail / Email ---

    async def _send_mail(self, email_address: str, text: str) -> bool:
        if not self._settings.smtp_host:
            # Mock SMTP email sender logging output
            logger.info(
                "email_notification_send_mock",
                extra={
                    "email": email_address,
                    "subject": "Thông báo UIT EduAdvisor",
                    "text_preview": text[:100],
                },
            )
            return True

        from email.message import EmailMessage
        import aiosmtplib

        import re
        subject = "Thông báo UIT EduAdvisor"
        is_html = text.strip().startswith("<")
        if is_html:
            title_match = re.search(r"<title>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
            if title_match:
                subject = title_match.group(1).strip()

        message = EmailMessage()
        message["From"] = self._settings.smtp_from_email or "no-reply@eduadvisor.uit.edu.vn"
        message["To"] = email_address
        message["Subject"] = subject
        if is_html:
            message.set_content(text, subtype="html")
        else:
            message.set_content(text)

        try:
            await aiosmtplib.send(
                message,
                hostname=self._settings.smtp_host,
                port=self._settings.smtp_port,
                username=self._settings.smtp_user or None,
                password=self._settings.smtp_password or None,
                use_tls=self._settings.smtp_use_tls,
                start_tls=not self._settings.smtp_use_tls and self._settings.smtp_port == 587,
            )
            logger.info("email_notification_sent", extra={"email": email_address})
            return True
        except Exception as e:
            logger.error(
                "email_notification_failed", extra={"email": email_address, "error": str(e)}
            )
            return False

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
    if settings.discord_bot_token or settings.smtp_host:
        return RealPlatformSender(settings)
    return MockPlatformSender()

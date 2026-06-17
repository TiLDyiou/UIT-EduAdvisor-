"""Mock platform sender: logs messages instead of sending them.

# MOCK_API: This is used when no bot token is configured.
# See docs/M7_BOT_INTEGRATION_GUIDE.md for instructions on switching to real tokens.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class MockPlatformSender:
    """Logs all outbound bot messages. Used when platform tokens are not configured."""

    async def send_message(self, platform: str, recipient_id: str, text: str) -> bool:
        # MOCK_API: replace when real token available -- see docs/M7_BOT_INTEGRATION_GUIDE.md
        logger.info(
            "mock_bot_send",
            extra={"platform": platform, "recipient_id": recipient_id, "text_preview": text[:100]},
        )
        return True

    async def validate_webhook(self, platform: str, headers: dict, body: bytes) -> bool:
        # MOCK_API: always returns True in mock mode
        logger.info("mock_webhook_validate", extra={"platform": platform})
        return True

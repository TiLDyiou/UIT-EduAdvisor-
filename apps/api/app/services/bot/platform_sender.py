"""Protocol for sending messages to bot platforms."""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class PlatformSender(Protocol):
    """Abstraction over bot platform APIs.

    Implementations:
    - MockPlatformSender: logs only (when no token is configured)
    - RealPlatformSender: calls real platform APIs (when tokens are set)
    """

    async def send_message(self, platform: str, recipient_id: str, text: str) -> bool:
        """Send a text message. Returns True on success."""
        ...

    async def validate_webhook(self, platform: str, headers: dict, body: bytes) -> bool:
        """Validate incoming webhook signature. Returns True if valid."""
        ...

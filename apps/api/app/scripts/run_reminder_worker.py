"""Reminder worker: periodically checks for upcoming exams/deadlines and sends bot notifications.

# MOCK_API: When no bot tokens are configured, reminders are logged but not sent.
# See docs/M7_BOT_INTEGRATION_GUIDE.md
"""

from __future__ import annotations

import asyncio
import logging

import redis.asyncio as redis_async

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import get_sessionmaker, init_engine
from app.services.bot.bot_reminders import check_and_send_reminders
from app.services.bot.real_sender import get_platform_sender

logger = logging.getLogger(__name__)


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.app_log_level)

    logger.info("reminder_worker_start", extra={
        "interval_seconds": settings.reminder_check_interval_seconds,
        "exam_hours_before": settings.reminder_exam_hours_before,
        "deadline_hours_before": settings.reminder_deadline_hours_before,
    })

    init_engine(settings.database_url)
    redis_client = redis_async.from_url(settings.redis_url, decode_responses=True)
    sender = get_platform_sender(settings)

    try:
        while True:
            try:
                maker = get_sessionmaker()
                async with maker() as db:
                    sent = await check_and_send_reminders(db, redis_client, sender)
                    if sent:
                        logger.info("reminders_sent", extra={"count": sent})
            except Exception:
                logger.exception("reminder_worker_error")

            await asyncio.sleep(settings.reminder_check_interval_seconds)
    finally:
        await redis_client.close()


if __name__ == "__main__":
    asyncio.run(main())

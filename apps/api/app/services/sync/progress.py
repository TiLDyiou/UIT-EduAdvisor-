"""Redis-backed sync progress for SSE."""

from __future__ import annotations

import json
import uuid
from typing import Any

from redis.asyncio import Redis


def _log_key(job_id: uuid.UUID) -> str:
    return f"sync:{job_id}:log"


def _chan(job_id: uuid.UUID) -> str:
    return f"sync:{job_id}:chan"


async def publish_sync_event(
    redis: Redis,
    job_id: uuid.UUID,
    *,
    stage: str,
    progress_percent: int,
    message: str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    payload = {
        "stage": stage,
        "progress_percent": progress_percent,
        "message": message,
        "detail": detail,
    }
    raw = json.dumps(payload, default=str)
    lk = _log_key(job_id)
    await redis.rpush(lk, raw)
    await redis.ltrim(lk, -200, -1)
    await redis.expire(lk, 86400)
    await redis.publish(_chan(job_id), raw)

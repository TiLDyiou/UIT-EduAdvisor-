from __future__ import annotations

import contextlib
import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from app.core.sessions import StudentSession
from app.db.models.core_security import SyncJob
from app.deps import get_current_student_session, get_db, get_redis

router = APIRouter(tags=["sync"])


@router.get("/sync-jobs/{job_id}/events")
async def sync_job_events(
    job_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
    sess: Annotated[StudentSession, Depends(get_current_student_session)],
) -> StreamingResponse:
    res = await db.execute(select(SyncJob).where(SyncJob.id == job_id).limit(1))
    job = res.scalar_one_or_none()
    if job is None or job.student_id != sess.student_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job_not_found")

    async def gen():
        log_key = f"sync:{job_id}:log"
        chan = f"sync:{job_id}:chan"
        initial = await redis.lrange(log_key, 0, -1)
        for raw in initial:
            yield f"data: {raw}\n\n"
        pubsub = redis.pubsub(ignore_subscribe_messages=True)
        await pubsub.subscribe(chan)
        try:
            while True:
                if await request.is_disconnected():
                    break
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30.0)
                if msg and msg.get("type") == "message" and msg.get("data"):
                    data = msg["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"data: {data}\n\n"
                    try:
                        parsed = json.loads(data)
                        if parsed.get("stage") == "completed" or parsed.get("stage") == "failed":
                            break
                    except Exception:
                        pass
        finally:
            with contextlib.suppress(Exception):
                await pubsub.unsubscribe(chan)
            closer = getattr(pubsub, "aclose", None) or getattr(pubsub, "close", None)
            if closer:
                maybe = closer()
                if hasattr(maybe, "__await__"):
                    await maybe

    return StreamingResponse(gen(), media_type="text/event-stream")

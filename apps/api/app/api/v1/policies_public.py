from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rate_limit import RateLimiter
from app.deps import get_db, get_redis
from app.schemas.rag import PolicyRetrieveItem, PolicyRetrieveRequest, PolicyRetrieveResponse
from app.services.rag_retrieval import retrieve_policy_chunks

router = APIRouter(tags=["policy-public"])


@router.post("/policies/retrieve", response_model=PolicyRetrieveResponse)
async def retrieve_policies(
    request: Request,
    body: PolicyRetrieveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> PolicyRetrieveResponse:
    settings = get_settings()
    ip = request.client.host if request.client else "unknown"
    rl = RateLimiter(redis)
    allowed, _, reset_in = await rl.check(
        f"policy:retrieve:ip:{ip}",
        settings.ai_public_policy_retrieve_per_hour,
        3600,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate_limited", "reset_in_seconds": reset_in},
        )
    rows = await retrieve_policy_chunks(db, query=body.query, limit=body.limit)
    return PolicyRetrieveResponse(
        query=body.query,
        items=[
            PolicyRetrieveItem(
                document_id=doc.id,
                document_title=doc.title,
                tag=doc.tag,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
            )
            for doc, chunk in rows
        ],
    )

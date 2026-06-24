from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.core.config import Settings
from app.core.rate_limit import RateLimiter
from app.db.models.core_security import Student
from app.deps import get_current_student, get_db, get_redis, get_settings_dep, require_csrf
from app.schemas.ai_mate import (
    AiMateChatRequest,
    AiMateDoneEvent,
    AiMateErrorEvent,
    AiMateMetaEvent,
    ChatSummaryOut,
    PinnedCreateRequest,
    PinnedMessageOut,
    PolicySourceMeta,
    SummaryCreateRequest,
)
from app.services.ai_mate import context as ai_context
from app.services.ai_mate import memory as ai_memory
from app.services.ai_mate import prompt as ai_prompt
from app.services.ai_mate.gemini import embed_text, generate_json_text, stream_generate_content
from app.services.ai_mate.privacy import parse_json_object_loose, sanitize_error_message
from app.services.rag_retrieval import retrieve_policy_chunks_for_ai

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-mate", tags=["ai-mate"])

_MAX_TRANSCRIPT_CHARS = 100_000
_RAG_LIMIT = 5
_RAG_SNIPPET = 700


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _stream_with_first_byte_timeout(
    agen: AsyncIterator[str],
    *,
    first_byte_seconds: float,
) -> AsyncIterator[str]:
    it = aiter(agen)
    try:
        first = await asyncio.wait_for(anext(it), timeout=first_byte_seconds)
    except StopAsyncIteration:
        return
    except TimeoutError:
        raise
    yield first
    async for chunk in it:
        yield chunk


@router.post("/chat/stream")
async def ai_mate_chat_stream(
    body: AiMateChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
    student: Annotated[Student, Depends(get_current_student)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> StreamingResponse:
    rid = str(uuid.uuid4())
    rl = RateLimiter(redis)
    
    # Global per-minute limit (27 requests / 60 seconds for the whole system)
    min_allowed, min_remaining, min_reset_in = await rl.check(
        "ai:chat:global:min",
        settings.ai_chat_rate_limit_per_minute,
        60,
    )
    if not min_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "ai_rate_limited", "reset_in_seconds": min_reset_in, "limit": "minute"},
        )

    # Global per-hour limit
    hr_allowed, hr_remaining, hr_reset_in = await rl.check(
        "ai:chat:global:hr",
        settings.ai_chat_rate_limit_per_hour,
        3600,
    )
    if not hr_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "ai_rate_limited", "reset_in_seconds": hr_reset_in, "limit": "hour"},
        )
        
    remaining = min(min_remaining, hr_remaining)

    query_embedding: list[float] | None
    try:
        query_embedding = await embed_text(settings, body.message)
    except Exception as exc:
        logger.warning(
            "ai_mate_embed_failed",
            extra={"request_id": rid, "student_id": str(student.id), "err": type(exc).__name__},
        )
        query_embedding = None

    rows, _mode = await retrieve_policy_chunks_for_ai(
        db,
        query=body.message,
        query_embedding=query_embedding,
        limit=_RAG_LIMIT,
    )
    sources = [
        PolicySourceMeta(
            document_id=doc.id,
            document_title=doc.title,
            tag=doc.tag,
            chunk_index=chunk.chunk_index,
            content=chunk.content,
        )
        for doc, chunk in rows
    ]
    excerpts = [c.content[:_RAG_SNIPPET] for _, c in rows]
    rag_block = ai_prompt.format_rag_block(sources, excerpts)

    realtime = await ai_context.build_realtime_context_block(db, student)
    historical = await ai_context.build_historical_context_block(db, student.id)
    policy_disclaimer_required = bool(sources) or ai_context.detect_policy_intent(body.message)

    system_instruction = ai_prompt.build_system_prompt(
        realtime_block=realtime,
        historical_block=historical,
        rag_block=rag_block,
        policy_disclaimer_required=policy_disclaimer_required,
    )
    user_prompt = ai_prompt.build_user_prompt(body.message)

    meta = AiMateMetaEvent(
        request_id=rid,
        remaining_messages=remaining,
        sources=sources,
    )

    async def gen() -> AsyncIterator[str]:
        yield _sse("meta", meta.model_dump(mode="json"))
        if not settings.groq_api_key.strip():
            err = AiMateErrorEvent(
                code="ai_unconfigured",
                message="AI chưa được cấu hình (thiếu khóa Groq trên máy chủ).",
            )
            yield _sse("error", err.model_dump(mode="json"))
            yield _sse("done", AiMateDoneEvent(policy_disclaimer_required=policy_disclaimer_required).model_dump())
            return
        stream = stream_generate_content(
            settings,
            system_instruction=system_instruction,
            user_text=user_prompt,
        )
        try:
            timed = _stream_with_first_byte_timeout(
                stream,
                first_byte_seconds=settings.ai_stream_first_byte_seconds,
            )
            async for piece in timed:
                if piece:
                    yield _sse("delta", {"text": piece})
        except TimeoutError:
            err = AiMateErrorEvent(
                code="ai_first_byte_timeout",
                message="Phản hồi từ AI quá chậm. Thử lại sau.",
            )
            yield _sse("error", err.model_dump(mode="json"))
        except Exception as exc:
            logger.warning(
                "ai_mate_stream_failed",
                extra={
                    "request_id": rid,
                    "student_id": str(student.id),
                    "err": sanitize_error_message(exc),
                },
            )
            err = AiMateErrorEvent(
                code="ai_upstream_error",
                message="Không thể hoàn tất câu trả lời. Thử lại sau.",
            )
            yield _sse("error", err.model_dump(mode="json"))
        yield _sse("done", AiMateDoneEvent(policy_disclaimer_required=policy_disclaimer_required).model_dump())

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.get("/summaries", response_model=list[ChatSummaryOut])
async def list_summaries(
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> list[ChatSummaryOut]:
    rows = await ai_memory.list_summaries(db, student.id, settings)
    return [
        ChatSummaryOut(
            id=r.id,
            session_started_at=r.session_started_at,
            courses_of_interest=list(r.courses_of_interest or []),
            recent_questions=list(r.recent_questions or []),
            created_at=r.created_at,
            expires_at=r.expires_at,
        )
        for r in rows
    ]


@router.post("/summaries", response_model=ChatSummaryOut, status_code=status.HTTP_201_CREATED)
async def create_summary_endpoint(
    body: SummaryCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    _: Annotated[None, Depends(require_csrf)],
) -> ChatSummaryOut:
    total = sum(len(m.content) for m in body.messages)
    if total > _MAX_TRANSCRIPT_CHARS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="transcript_too_large")

    lines: list[str] = []
    for i, m in enumerate(body.messages):
        lines.append(f"{i + 1}. [{m.role}] {m.content}")
    user_block = "\n".join(lines)

    raw = await generate_json_text(
        settings,
        system_instruction=ai_prompt.summary_system_prompt(),
        user_text=user_block,
    )
    parsed = parse_json_object_loose(raw) or {}
    coi = parsed.get("courses_of_interest") or []
    rq = parsed.get("recent_questions") or []
    if not isinstance(coi, list):
        coi = []
    if not isinstance(rq, list):
        rq = []
    coi_s = [str(x) for x in coi if str(x).strip()][:16]
    rq_s = [str(x) for x in rq if str(x).strip()][:16]

    row = await ai_memory.create_summary(
        db,
        student_id=student.id,
        session_started_at=body.session_started_at,
        courses_of_interest=coi_s,
        recent_questions=rq_s,
        settings=settings,
    )
    await db.commit()
    return ChatSummaryOut(
        id=row.id,
        session_started_at=row.session_started_at,
        courses_of_interest=list(row.courses_of_interest or []),
        recent_questions=list(row.recent_questions or []),
        created_at=row.created_at,
        expires_at=row.expires_at,
    )


@router.delete("/summaries/{summary_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_summary_endpoint(
    summary_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
) -> Response:
    ok = await ai_memory.delete_summary(db, student.id, summary_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/pins", response_model=list[PinnedMessageOut])
async def list_pins(
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
) -> list[PinnedMessageOut]:
    rows = await ai_memory.list_pins(db, student.id)
    return [
        PinnedMessageOut(id=r.id, content=r.content, created_at=r.created_at) for r in rows
    ]


@router.get("/documents/{doc_id}/pdf")
async def get_document_pdf(
    doc_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    import os
    from app.db.models.rag_chat import PolicyDocument
    res = await db.execute(select(PolicyDocument).where(PolicyDocument.id == doc_id))
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # the file path might be "docs/xxx.pdf". We resolve it relative to the api root.
    # __file__ is /app/app/api/v1/ai_mate.py in docker, project root is /app
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    
    file_path = doc.file_path
    if not os.path.isabs(file_path):
        file_path = os.path.join(project_root, "..", "..", file_path) # if running locally
        if not os.path.exists(file_path):
            file_path = os.path.join(project_root, file_path) # if running in docker
            
    if not os.path.exists(file_path):
        # fallback for docker
        if doc.file_path.startswith("docs/"):
            file_path = os.path.join("/app", "..", doc.file_path)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    return FileResponse(
        file_path, 
        media_type="application/pdf", 
        content_disposition_type="inline", 
        filename=doc.source_filename or "document.pdf"
    )


@router.post("/pins", response_model=PinnedMessageOut, status_code=status.HTTP_201_CREATED)
async def create_pin(
    body: PinnedCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
) -> PinnedMessageOut:
    row = await ai_memory.create_pin(db, student_id=student.id, content=body.content.strip())
    await db.commit()
    return PinnedMessageOut(id=row.id, content=row.content, created_at=row.created_at)


@router.delete("/pins/{pin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pin(
    pin_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
) -> Response:
    ok = await ai_memory.delete_pin(db, student.id, pin_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
    _: Annotated[None, Depends(require_csrf)],
) -> Response:
    await ai_memory.delete_all_ai_memory(db, student.id)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from __future__ import annotations

import logging

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.rag_chat import PolicyChunk, PolicyDocument

logger = logging.getLogger(__name__)


async def retrieve_policy_chunks(
    db: AsyncSession,
    *,
    query: str,
    limit: int,
) -> list[tuple[PolicyDocument, PolicyChunk]]:
    token = f"%{query.strip()}%"
    stmt = (
        select(PolicyDocument, PolicyChunk)
        .join(PolicyChunk, PolicyChunk.document_id == PolicyDocument.id)
        .where(
            PolicyDocument.is_deprecated.is_(False),
            or_(
                PolicyChunk.content.ilike(token),
                PolicyDocument.title.ilike(token),
                PolicyDocument.tag.ilike(token),
            ),
        )
        .order_by(PolicyDocument.id.desc(), PolicyChunk.chunk_index.asc())
        .limit(limit)
    )
    rows = await db.execute(stmt)
    return list(rows.all())


async def retrieve_policy_chunks_vector(
    db: AsyncSession,
    *,
    query_embedding: list[float],
    limit: int,
) -> list[tuple[PolicyDocument, PolicyChunk]]:
    if len(query_embedding) != 768:
        raise ValueError("query_embedding_dim_must_be_768")
    stmt = (
        select(PolicyDocument, PolicyChunk)
        .join(PolicyChunk, PolicyChunk.document_id == PolicyDocument.id)
        .where(
            PolicyDocument.is_deprecated.is_(False),
            PolicyChunk.embedding.isnot(None),
        )
        .order_by(
            PolicyChunk.embedding.cosine_distance(query_embedding),
            PolicyDocument.uploaded_at.desc(),
            PolicyChunk.chunk_index.asc(),
        )
        .limit(limit)
    )
    rows = await db.execute(stmt)
    return list(rows.all())


async def retrieve_policy_chunks_for_ai(
    db: AsyncSession,
    *,
    query: str,
    query_embedding: list[float] | None,
    limit: int,
) -> tuple[list[tuple[PolicyDocument, PolicyChunk]], str]:
    """Prefer pgvector when embedding is available; fall back to keyword ILIKE."""
    if query_embedding is not None:
        try:
            vec_rows = await retrieve_policy_chunks_vector(
                db, query_embedding=query_embedding, limit=limit
            )
            if vec_rows:
                return vec_rows, "vector"
        except Exception as exc:
            logger.warning(
                "rag_vector_failed",
                extra={"error_type": type(exc).__name__},
            )
    kw_rows = await retrieve_policy_chunks(db, query=query, limit=limit)
    return kw_rows, "keyword"

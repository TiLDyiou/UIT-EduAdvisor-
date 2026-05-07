from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.rag_chat import PolicyChunk, PolicyDocument


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
        .order_by(PolicyDocument.effective_year.desc(), PolicyDocument.id.desc(), PolicyChunk.chunk_index.asc())
        .limit(limit)
    )
    rows = await db.execute(stmt)
    return list(rows.all())

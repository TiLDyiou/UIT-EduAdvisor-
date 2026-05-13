from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.schemas.rag import PolicyRetrieveItem, PolicyRetrieveRequest, PolicyRetrieveResponse
from app.services.rag_retrieval import retrieve_policy_chunks

router = APIRouter(tags=["policy-public"])


@router.post("/policies/retrieve", response_model=PolicyRetrieveResponse)
async def retrieve_policies(
    body: PolicyRetrieveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PolicyRetrieveResponse:
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

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.db.models.rag_chat import PolicyChunk, PolicyDocument
from app.deps import get_db, get_redis
from app.services.policy_ingest import pseudo_embedding_768
from app.services.rag_retrieval import retrieve_policy_chunks_vector

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def app(db_session, redis_async_client) -> AsyncIterator[FastAPI]:
    await redis_async_client.flushdb()
    app = FastAPI()
    app.include_router(v1_router, prefix="/api/v1")

    async def _override_db():
        yield db_session

    def _override_redis():
        return redis_async_client

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_redis] = _override_redis
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_policy_retrieval_excludes_deprecated_by_default(client, db_session) -> None:
    active = PolicyDocument(
        title="QCDT active",
        tag="qcdt",
        file_path="/tmp/a.pdf",
        uploaded_at=datetime.now(UTC),
        is_deprecated=False,
    )
    old = PolicyDocument(
        title="QCDT old",
        tag="qcdt",
        file_path="/tmp/b.pdf",
        uploaded_at=datetime.now(UTC),
        is_deprecated=True,
    )
    db_session.add(active)
    db_session.add(old)
    await db_session.flush()
    emb = pseudo_embedding_768("dao tao")
    db_session.add(
        PolicyChunk(
            document_id=active.id, chunk_index=0, content="hoc vu quy che dao tao", embedding=emb
        )
    )
    db_session.add(
        PolicyChunk(
            document_id=old.id, chunk_index=0, content="hoc vu quy che dao tao cu", embedding=emb
        )
    )
    await db_session.commit()

    r = await client.post("/api/v1/policies/retrieve", json={"query": "dao tao", "limit": 10})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert all(item["document_id"] == active.id for item in items)


async def test_policy_vector_ordering_prefers_closer_embedding(db_session) -> None:
    q = pseudo_embedding_768("query unique alpha")
    doc_a = PolicyDocument(
        title="A",
        tag="t",
        file_path="/tmp/a.pdf",
        uploaded_at=datetime(2024, 1, 1, tzinfo=UTC),
        is_deprecated=False,
    )
    doc_b = PolicyDocument(
        title="B",
        tag="t",
        file_path="/tmp/b.pdf",
        uploaded_at=datetime(2025, 1, 1, tzinfo=UTC),
        is_deprecated=False,
    )
    db_session.add(doc_a)
    db_session.add(doc_b)
    await db_session.flush()
    db_session.add(
        PolicyChunk(
            document_id=doc_a.id,
            chunk_index=0,
            content="x",
            embedding=pseudo_embedding_768("unrelated text zzz"),
        )
    )
    db_session.add(
        PolicyChunk(
            document_id=doc_b.id,
            chunk_index=0,
            content="y",
            embedding=q,
        )
    )
    await db_session.commit()

    rows = await retrieve_policy_chunks_vector(db_session, query_embedding=q, limit=5)
    assert rows[0][0].id == doc_b.id

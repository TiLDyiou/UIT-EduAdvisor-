from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.db.models.rag_chat import PolicyChunk, PolicyDocument
from app.deps import get_db

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def app(db_session) -> AsyncIterator[FastAPI]:
    app = FastAPI()
    app.include_router(v1_router, prefix="/api/v1")

    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
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
        version="v2",
        effective_year=2026,
        tag="qcdt",
        file_path="/tmp/a.pdf",
        uploaded_at=datetime.now(UTC),
        is_deprecated=False,
    )
    old = PolicyDocument(
        title="QCDT old",
        version="v1",
        effective_year=2025,
        tag="qcdt",
        file_path="/tmp/b.pdf",
        uploaded_at=datetime.now(UTC),
        is_deprecated=True,
    )
    db_session.add(active)
    db_session.add(old)
    await db_session.flush()
    db_session.add(PolicyChunk(document_id=active.id, chunk_index=0, content="hoc vu quy che dao tao"))
    db_session.add(PolicyChunk(document_id=old.id, chunk_index=0, content="hoc vu quy che dao tao cu"))
    await db_session.commit()

    r = await client.post("/api/v1/policies/retrieve", json={"query": "dao tao", "limit": 10})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert all(item["effective_year"] >= 2026 for item in items)

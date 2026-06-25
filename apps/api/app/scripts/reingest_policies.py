"""One-off script to re-ingest policy PDFs with real Gemini embeddings.

Usage:
    cd apps/api
    .venv/bin/python -m app.scripts.reingest_policies
"""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select

from app.core.config import get_settings
from app.db.models.rag_chat import PolicyChunk, PolicyDocument
from app.db.session import close_engine, get_sessionmaker, init_engine
from app.services.ai_mate.gemini import batch_embed_texts
from app.services.policy_ingest import chunk_policy_text, extract_policy_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Documents to ingest. Add entries here as needed.
DOCS = [
    {
        "file": "docs/790-qd-dhcntt_28-9-22_quy_che_dao_tao.pdf",
        "title": "Quy chế đào tạo theo học chế tín chỉ cho hệ đại học chính quy (QĐ 790)",
        "tag": "dao_tao",
    },
    {
        "file": "docs/1393-qd-dhcntt_29-12-2023_cap_nhat_quy_che_dao_tao_theo_hoc_che_tin_chi_cho_he_dai_hoc_chinh_quy.pdf",
        "title": "Cập nhật quy chế đào tạo theo học chế tín chỉ (QĐ 1393)",
        "tag": "dao_tao_bo_sung",
    },
]

# Project root (relative to apps/api/app/scripts/reingest_policies.py)
# Fallback to /app if running inside docker
PROJECT_ROOT = (
    Path(__file__).resolve().parents[4]
    if len(Path(__file__).resolve().parents) > 4
    else Path("/app")
)


async def ingest_one(db, settings, doc_info: dict) -> None:
    file_path = PROJECT_ROOT / doc_info["file"]
    title = doc_info["title"]
    tag = doc_info["tag"]

    if not file_path.exists():
        logger.error("File not found: %s", file_path)
        return

    logger.info("=== Ingesting: %s ===", title)

    # 1. Extract text
    ext = file_path.suffix.lower()
    if ext == ".txt":
        text = file_path.read_text(encoding="utf-8").strip()
    else:
        text = extract_policy_text(str(file_path))

    if not text:
        logger.error("Empty text from %s — skipping (scanned PDF?)", file_path.name)
        return
    logger.info("Extracted %d chars", len(text))

    # 2. Chunk
    chunk_dicts = chunk_policy_text(text, title)
    chunks = [c["content"] for c in chunk_dicts]
    logger.info("Created %d chunks", len(chunks))

    # 3. Embed with Gemini
    logger.info("Embedding %d chunks with Gemini (gemini-embedding-2, 768-dim)...", len(chunks))
    vectors = await batch_embed_texts(settings, chunks, title=title)
    logger.info("Embedding complete")

    # 4. Upsert document
    res = await db.execute(
        select(PolicyDocument)
        .where(
            PolicyDocument.tag == tag,
            PolicyDocument.title == title,
        )
        .limit(1)
    )
    doc = res.scalar_one_or_none()

    if doc is None:
        doc = PolicyDocument(
            title=title,
            tag=tag,
            file_path=doc_info["file"],
            source_filename=file_path.name,
            mime_type="application/pdf" if ext == ".pdf" else "text/plain",
            file_size_bytes=file_path.stat().st_size,
            uploaded_at=datetime.now(UTC),
            is_deprecated=False,
        )
        db.add(doc)
        await db.flush()
        logger.info("Created PolicyDocument id=%d", doc.id)
    else:
        logger.info("Found existing PolicyDocument id=%d, replacing chunks", doc.id)

    # 5. Replace chunks
    await db.execute(delete(PolicyChunk).where(PolicyChunk.document_id == doc.id))
    for idx, (chunk_text_str, emb) in enumerate(zip(chunks, vectors, strict=True)):
        db.add(
            PolicyChunk(
                document_id=doc.id,
                chunk_index=idx,
                content=chunk_text_str,
                embedding=emb,
            )
        )

    doc.chunk_count = len(chunks)
    doc.is_deprecated = False
    doc.deprecated_at = None

    # Deprecate older documents with same tag
    others = await db.execute(
        select(PolicyDocument).where(
            PolicyDocument.tag == tag,
            PolicyDocument.id != doc.id,
            PolicyDocument.is_deprecated.is_(False),
        )
    )
    for row in others.scalars().all():
        row.is_deprecated = True
        row.deprecated_at = datetime.now(UTC)
        logger.info("Deprecated older doc id=%d", row.id)

    await db.commit()
    logger.info("✓ Done: %d chunks saved for '%s'", len(chunks), title)


async def main() -> None:
    settings = get_settings()

    if not settings.ai_gemini_api_key.strip():
        logger.error("AI_GEMINI_API_KEY is not set. Cannot embed without it.")
        sys.exit(1)

    init_engine(settings.database_url)
    maker = get_sessionmaker()

    try:
        for doc_info in DOCS:
            async with maker() as db:
                await ingest_one(db, settings, doc_info)
    finally:
        await close_engine()

    logger.info("All done.")


if __name__ == "__main__":
    asyncio.run(main())

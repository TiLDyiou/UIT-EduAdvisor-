"""Admin background worker (M4 phase 4 foundation).

Run:
    python -m app.scripts.run_admin_worker
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import delete, select

from app.core.config import get_settings
from app.db.models.academic import Course, TermCourseOffering, TermCourseSection, TermExamSchedule
from app.db.models.rag_chat import PolicyChunk, PolicyDocument
from app.db.session import close_engine, get_sessionmaker, init_engine
from app.services.admin_jobs import (
    JOB_STATUS_FAILED,
    JOB_STATUS_SUCCEEDED,
    claim_next_job,
)
from app.services.ai_mate.gemini import batch_embed_texts
from app.services.excel_import import preview_course_offerings_file, preview_exam_schedule_xlsx
from app.services.policy_ingest import chunk_policy_text, extract_policy_text

logger = logging.getLogger(__name__)
SUPPORTED_KINDS = {"policy_ingest", "course_offering_import", "exam_schedule_import"}


async def _handle_policy_ingest(db, job) -> None:
    res = await db.execute(
        select(PolicyDocument).where(PolicyDocument.ingest_job_id == job.id).limit(1)
    )
    doc = res.scalar_one_or_none()
    if doc is None:
        raise ValueError("policy_document_not_found_for_job")

    job.current_stage = "extracting_text"
    job.progress_percent = 15
    await db.flush()

    text = extract_policy_text(doc.file_path, doc.source_filename)
    if not text:
        raise ValueError("empty_policy_text")

    chunk_dicts = chunk_policy_text(text, doc.title)
    if not chunk_dicts:
        raise ValueError("no_policy_chunks")
    chunks = [c["content"] for c in chunk_dicts]

    job.current_stage = "embedding_chunks"
    job.progress_percent = 55
    settings = get_settings()
    vectors = await batch_embed_texts(settings, chunks, title=doc.title)

    job.current_stage = "saving_chunks"
    job.progress_percent = 70
    await db.execute(delete(PolicyChunk).where(PolicyChunk.document_id == doc.id))
    for idx, (chunk, emb) in enumerate(zip(chunks, vectors, strict=True)):
        db.add(
            PolicyChunk(
                document_id=doc.id,
                chunk_index=idx,
                content=chunk,
                embedding=emb,
            )
        )

    # Chỉ deprecate bản active cùng tag sau khi ingest thành công.
    others = await db.execute(
        select(PolicyDocument).where(
            PolicyDocument.tag == doc.tag,
            PolicyDocument.id != doc.id,
            PolicyDocument.is_deprecated.is_(False),
        )
    )
    for row in others.scalars().all():
        row.is_deprecated = True
        row.deprecated_at = datetime.now(UTC)

    doc.chunk_count = len(chunks)
    doc.is_deprecated = False
    doc.deprecated_at = None
    job.current_stage = "completed"
    job.progress_percent = 100
    job.result_summary = {
        **(job.result_summary or {}),
        "chunk_count": len(chunks),
    }


async def _preview_import(db, job) -> None:
    if not job.input_file_path:
        raise ValueError("missing_input_file_path")
    if job.kind == "exam_schedule_import":
        preview = preview_exam_schedule_xlsx(job.input_file_path)
    else:
        preview = preview_course_offerings_file(job.input_file_path)
    job.current_stage = "preview_completed"
    job.progress_percent = 100
    job.result_summary = {
        **(job.result_summary or {}),
        "preview": {
            "valid_rows": len(preview.ok_rows),
            "invalid_rows": len(preview.errors),
            "errors": preview.errors[:200],
            "rows": preview.ok_rows,
            "sample_rows": preview.ok_rows[:200],
        },
    }


async def _apply_exam_import(db, job) -> None:
    preview = (job.result_summary or {}).get("preview") or {}
    rows = preview.get("rows") or []
    if not rows:
        raise ValueError("no_preview_rows_to_apply")

    job.current_stage = "apply_running"
    job.progress_percent = 20

    # rollback-friendly strategy: xóa dữ liệu cũ của đúng term rồi insert lại.
    term_codes = sorted({str(r["term_code"]) for r in rows})
    if term_codes:
        await db.execute(delete(TermExamSchedule).where(TermExamSchedule.term_code.in_(term_codes)))

    inserted = 0
    for r in rows:
        course_code = str(r["course_code"]).strip().upper()
        cres = await db.execute(select(Course).where(Course.code == course_code).limit(1))
        course = cres.scalar_one_or_none()
        if course is None:
            raise ValueError(f"course_not_found:{course_code}")
        db.add(
            TermExamSchedule(
                term_code=r["term_code"],
                course_id=course.id,
                exam_date=datetime.fromisoformat(r["exam_date"]).date(),
                start_time=datetime.strptime(r["start_time"], "%H:%M:%S").time(),
                end_time=datetime.strptime(r["end_time"], "%H:%M:%S").time(),
                room=r.get("room"),
                kind="theory_midterm",
                source_job_id=job.id,
                source_file_path=job.input_file_path,
            )
        )
        inserted += 1
    job.current_stage = "apply_completed"
    job.progress_percent = 100
    job.result_summary = {
        **(job.result_summary or {}),
        "apply": {"inserted_exam_rows": inserted, "term_codes": term_codes},
    }


async def _apply_offering_import(db, job) -> None:
    preview = (job.result_summary or {}).get("preview") or {}
    rows = preview.get("rows") or []
    if not rows:
        raise ValueError("no_preview_rows_to_apply")
    job.current_stage = "apply_running"
    job.progress_percent = 20
    term_codes = sorted({str(r["term_code"]) for r in rows})
    if term_codes:
        existing = await db.execute(
            select(TermCourseOffering.id).where(TermCourseOffering.term_code.in_(term_codes))
        )
        existing_ids = [x for x in existing.scalars().all()]
        if existing_ids:
            await db.execute(
                delete(TermCourseSection).where(TermCourseSection.offering_id.in_(existing_ids))
            )
        await db.execute(
            delete(TermCourseOffering).where(TermCourseOffering.term_code.in_(term_codes))
        )

    offering_map: dict[tuple[str, int], int] = {}
    inserted_offerings = 0
    inserted_sections = 0
    for r in rows:
        course_code = str(r["course_code"]).strip().upper()
        cres = await db.execute(select(Course).where(Course.code == course_code).limit(1))
        course = cres.scalar_one_or_none()
        if course is None:
            course = Course(
                code=course_code,
                name=r["course_name"],
                credits=int(r["credits"]),
                kind="elective",
                difficulty=None,
                admin_locked=False,
            )
            db.add(course)
            await db.flush()
        key = (r["term_code"], course.id)
        if key not in offering_map:
            off = TermCourseOffering(
                term_code=r["term_code"],
                course_id=course.id,
                source_job_id=job.id,
                source_file_path=job.input_file_path,
            )
            db.add(off)
            await db.flush()
            offering_map[key] = off.id
            inserted_offerings += 1
        if r.get("section_code"):
            db.add(
                TermCourseSection(
                    offering_id=offering_map[key],
                    section_code=r["section_code"],
                    day_of_week=r.get("day_of_week"),
                    start_period=r.get("start_period"),
                    end_period=r.get("end_period"),
                    room=r.get("room"),
                    source_job_id=job.id,
                )
            )
            inserted_sections += 1
    job.current_stage = "apply_completed"
    job.progress_percent = 100
    job.result_summary = {
        **(job.result_summary or {}),
        "apply": {
            "inserted_offerings": inserted_offerings,
            "inserted_sections": inserted_sections,
            "term_codes": term_codes,
        },
    }


async def _run_forever() -> None:
    settings = get_settings()
    init_engine(settings.database_url)
    maker = get_sessionmaker()
    logger.info("admin worker started")
    try:
        while True:
            processed = False
            async with maker() as db:
                job = await claim_next_job(db, kinds=SUPPORTED_KINDS)
                if job is not None:
                    processed = True
                    try:
                        if job.kind == "policy_ingest":
                            await _handle_policy_ingest(db, job)
                        else:
                            if job.current_stage == "apply_queued":
                                if job.kind == "exam_schedule_import":
                                    await _apply_exam_import(db, job)
                                else:
                                    await _apply_offering_import(db, job)
                            else:
                                await _preview_import(db, job)
                        job.status = JOB_STATUS_SUCCEEDED
                        job.finished_at = datetime.now(UTC)
                    except Exception as exc:
                        job.status = JOB_STATUS_FAILED
                        job.current_stage = "failed"
                        job.error_message = str(exc)
                        job.finished_at = datetime.now(UTC)
                    await db.commit()
            if not processed:
                await asyncio.sleep(1.0)
    finally:
        await close_engine()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_run_forever())


if __name__ == "__main__":
    main()

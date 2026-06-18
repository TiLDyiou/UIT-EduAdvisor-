"""First-time onboarding sync: DAA pages + Moodle calendar."""

from __future__ import annotations

import contextlib
import logging
import re
from datetime import UTC, date, datetime
from datetime import time as dt_time
from typing import Any

import httpx
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security.audit import record_audit
from app.core.security.vault_transit import VaultTransit
from app.db.models.academic import Course, Deadline, Enrollment, Exam, Schedule
from app.db.models.core_security import Student, SyncJob
from app.db.session import get_sessionmaker
from app.services.daa.client import daa_get_text
from app.services.daa.parser import (
    parse_exam_rows,
    parse_grades_tables,
    parse_profile_name,
    parse_registration_table,
    parse_schedule_rows,
    parse_grades_summary,
)
from app.services.moodle.client import moodle_get_text, moodle_login
from app.services.moodle.parser import parse_due_datetime, parse_upcoming_deadlines
from app.services.sync.progress import publish_sync_event

logger = logging.getLogger(__name__)


async def _emit(redis, job_id, stage: str, pct: int, msg: str | None = None) -> None:
    await publish_sync_event(redis, job_id, stage=stage, progress_percent=pct, message=msg)


async def _update_job(
    session: AsyncSession,
    job_id,
    *,
    stage: str | None = None,
    pct: int | None = None,
    status: str | None = None,
    err: str | None = None,
    summary: dict[str, Any] | None = None,
) -> None:
    values: dict[str, Any] = {}
    if stage is not None:
        values["current_stage"] = stage
    if pct is not None:
        values["progress_percent"] = pct
    if status is not None:
        values["status"] = status
    if err is not None:
        values["error_message"] = err
    if summary is not None:
        values["result_summary"] = summary
    if status == "completed":
        values["finished_at"] = datetime.now(UTC)
    if values:
        await session.execute(update(SyncJob).where(SyncJob.id == job_id).values(**values))
        await session.commit()


async def _ensure_course(
    session: AsyncSession, code: str, name: str | None, credits: Any
) -> Course:
    normalized_code = _normalize_course_code(code)
    if not normalized_code:
        raise ValueError("invalid_course_code")
    res = await session.execute(select(Course).where(Course.code == normalized_code).limit(1))
    row = res.scalar_one_or_none()
    if row:
        if row.admin_locked:
            return row
        if name and name != row.name:
            row.name = name[:2000]
        if credits is not None:
            with contextlib.suppress(Exception):
                row.credits = int(credits)
        return row
    creds = 0
    if credits is not None:
        try:
            creds = int(credits)
        except Exception:
            creds = 0
    c = Course(
        code=normalized_code,
        name=(name or normalized_code)[:2000],
        credits=creds,
        kind="daa",
    )
    session.add(c)
    await session.flush()
    return c


async def _persist_grades(session: AsyncSession, student_id, rows: list[dict[str, Any]]) -> None:
    for row in rows:
        code = str(row.get("course_code") or "").strip()
        if not code:
            continue
        c = await _ensure_course(
            session, code, str(row.get("course_name") or ""), row.get("credits")
        )
        term = str(row.get("term_code") or "UNKNOWN")[:32]
        res = await session.execute(
            select(Enrollment)
            .where(
                Enrollment.student_id == student_id,
                Enrollment.course_id == c.id,
                Enrollment.term_code == term,
            )
            .limit(1)
        )
        en = res.scalar_one_or_none()
        if en is None:
            en = Enrollment(
                student_id=student_id,
                course_id=c.id,
                term_code=term,
                status="recorded",
                final_grade_10=row.get("final_grade_10"),
            )
            session.add(en)
        else:
            en.final_grade_10 = row.get("final_grade_10")
            en.status = "recorded"


async def _persist_schedule(session: AsyncSession, student_id, rows: list[dict[str, Any]]) -> None:
    term = "CURRENT"
    for r in rows:
        raw_code = str(r.get("course_code") or "").strip()
        code = _normalize_course_code(raw_code)
        if not code:
            continue
        course_name = str(r.get("course_name") or "").strip() or code
        c = await _ensure_course(session, code, course_name, None)
        await _upsert_enrollment(
            session,
            student_id=student_id,
            course_id=c.id,
            term_code=term,
            status="in_progress",
            final_grade_10=None,
        )
        dow = int(r.get("day_of_week") or 1)
        sp = int(r.get("start_period") or 1)
        ep = int(r.get("end_period") or sp)
        room = r.get("room")
        session.add(
            Schedule(
                student_id=student_id,
                course_id=c.id,
                term_code=term[:32],
                day_of_week=dow,
                start_period=sp,
                end_period=ep,
                room=str(room)[:500] if room else None,
            )
        )


def _parse_exam_dt(s: str | None) -> tuple[date, dt_time, dt_time] | None:
    if not s:
        return None
    m = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", s)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        exam_date = date(y, mo, d)
    except Exception:
        return None
    t1 = re.search(r"(\d{1,2}):(\d{2})", s)
    if t1:
        hh, mm = int(t1.group(1)), int(t1.group(2))
        start = dt_time(hh, mm)
        end = dt_time(min(hh + 2, 23), mm)
    else:
        start = dt_time(7, 0)
        end = dt_time(9, 0)
    return exam_date, start, end


async def _persist_exams(session: AsyncSession, student_id, rows: list[dict[str, Any]]) -> None:
    term = "CURRENT"
    for r in rows:
        code = str(r.get("course_code") or "").strip()
        if not code:
            continue
        code = _normalize_course_code(code) or code[:32]
        if not code:
            continue
        parsed = _parse_exam_dt(str(r.get("exam_datetime") or ""))
        if not parsed:
            continue
        exam_date, start_t, end_t = parsed
        c = await _ensure_course(session, code, code, None)
        await _upsert_enrollment(
            session,
            student_id=student_id,
            course_id=c.id,
            term_code=term,
            status="in_progress",
            final_grade_10=None,
        )
        room = r.get("room")
        session.add(
            Exam(
                student_id=student_id,
                course_id=c.id,
                term_code=term[:32],
                exam_date=exam_date,
                start_time=start_t,
                end_time=end_t,
                room=str(room)[:500] if room else None,
                kind="daa",
            )
        )


async def _upsert_enrollment(
    session: AsyncSession,
    *,
    student_id,
    course_id: int,
    term_code: str,
    status: str,
    final_grade_10: Any | None,
) -> None:
    normalized_term = term_code[:32]
    res = await session.execute(
        select(Enrollment)
        .where(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course_id,
            Enrollment.term_code == normalized_term,
        )
        .limit(1)
    )
    en = res.scalar_one_or_none()
    if en is None:
        en = Enrollment(
            student_id=student_id,
            course_id=course_id,
            term_code=normalized_term,
            status=status,
            final_grade_10=final_grade_10,
        )
        session.add(en)
        return
    if en.final_grade_10 is None and final_grade_10 is not None:
        en.final_grade_10 = final_grade_10
    if en.status != "recorded":
        en.status = status


def _normalize_course_code(raw: str | None) -> str | None:
    if not raw:
        return None
    text = re.sub(r"\s+", " ", raw).strip()
    if not text:
        return None
    first_token = text.split(" ", 1)[0].strip(".,;:-")
    if _looks_like_course_code(first_token):
        return first_token[:32]
    m = re.search(r"\b([A-Z]{2,}\d{2,4}(?:\.[A-Z0-9]+)*)\b", text.upper())
    if not m:
        return text[:32]
    return m.group(1)[:32]


def _looks_like_course_code(s: str) -> bool:
    return bool(re.fullmatch(r"[A-Z0-9]+(?:\.[A-Z0-9]+)*", s)) and any(
        ch.isdigit() for ch in s
    )


async def _persist_moodle_deadlines(session: AsyncSession, student_id, html: str) -> None:
    await session.execute(
        delete(Deadline).where(Deadline.student_id == student_id, Deadline.source == "moodle")
    )
    for d in parse_upcoming_deadlines(html):
        due = parse_due_datetime(str(d.get("due_text") or ""))
        if due is None:
            continue
        title = str(d.get("title") or "Moodle")[:2000]
        session.add(
            Deadline(
                student_id=student_id,
                course_id=None,
                title=title,
                due_at=due,
                source="moodle",
                source_url=str(d.get("source_url") or "")[:2000] or None,
            )
        )


async def run_onboarding_sync(
    *,
    job_id,
    student_id,
    student_code: str,
    password_plain: str,
    daa_client: httpx.AsyncClient,
    settings: Settings,
    redis,
    vault_transit: VaultTransit,
) -> None:
    maker = get_sessionmaker()
    moodle_client: httpx.AsyncClient | None = None
    summary: dict[str, Any] = {"daa": "ok", "moodle": "unknown"}
    try:
        async with maker() as session:
            await _update_job(session, job_id, stage="daa_profile", pct=15, status="running")

        await _emit(redis, job_id, "daa_profile", 15, "Đang tải hồ sơ DAA")
        profile_html = await daa_get_text(daa_client, settings.daa_profile_path)
        name = parse_profile_name(profile_html)
        async with maker() as session:
            if name:
                res = await session.execute(
                    select(Student).where(Student.id == student_id).limit(1)
                )
                st = res.scalar_one_or_none()
                if st:
                    st.full_name_ciphertext = await vault_transit.encrypt(name.encode("utf-8"))
                    await session.commit()

        await _emit(redis, job_id, "daa_grades", 35, "Đang đồng bộ điểm")
        grades_html = await daa_get_text(daa_client, settings.daa_grades_path)
        # DEBUG: save HTML and log parse results
        try:
            with open("/tmp/daa_grades_debug.html", "w", encoding="utf-8") as f:
                f.write(grades_html)
            logger.warning("DEBUG: saved grades HTML to /tmp/daa_grades_debug.html (%d bytes)", len(grades_html))
        except Exception as exc:
            logger.warning("DEBUG: failed to save grades HTML: %s", exc)
        grade_rows = parse_grades_tables(grades_html)
        logger.warning("DEBUG: parse_grades_tables returned %d rows", len(grade_rows))
        for i, row in enumerate(grade_rows[:5]):
            logger.warning("DEBUG: grade_row[%d] = %s", i, row)
        async with maker() as session:
            await _persist_grades(session, student_id, grade_rows)
            await session.commit()

        # Crawl and parse GPA summary from /sinhvien/kqhoctap
        try:
            summary_html = await daa_get_text(daa_client, settings.daa_grades_summary_path)
            # DEBUG: save summary HTML
            try:
                with open("/tmp/daa_grades_summary_debug.html", "w", encoding="utf-8") as f:
                    f.write(summary_html)
                logger.warning("DEBUG: saved grades summary HTML (%d bytes)", len(summary_html))
                # Also try parsing grades from summary page
                from app.services.daa.parser import parse_grades_tables as _pgt
                summary_grade_rows = _pgt(summary_html)
                logger.warning("DEBUG: parse_grades_tables on SUMMARY page returned %d rows", len(summary_grade_rows))
                for i, row in enumerate(summary_grade_rows[:5]):
                    logger.warning("DEBUG: summary_grade_row[%d] = %s", i, row)
            except Exception as exc2:
                logger.warning("DEBUG: summary debug failed: %s", exc2)
            summary_data = parse_grades_summary(summary_html)
            summary.update({
                "daa_dtbc_10": summary_data.get("dtbc_10"),
                "daa_dtbc_4": summary_data.get("dtbc_4"),
                "daa_dtbctl_10": summary_data.get("dtbctl_10"),
                "daa_dtbctl_4": summary_data.get("dtbctl_4"),
                "daa_earned_credits": summary_data.get("earned_credits"),
            })
        except Exception as exc:
            logger.warning("Failed to parse grades summary from DAA: %s", exc)


        # Fetch ĐKHP registration page for current semester courses
        await _emit(redis, job_id, "daa_registration", 42, "Đang đồng bộ thông tin ĐKHP")
        try:
            reg_html = await daa_get_text(daa_client, settings.daa_registration_path)
            reg_rows = parse_registration_table(reg_html)
            logger.info("ĐKHP: parsed %d registered courses", len(reg_rows))
            if reg_rows:
                async with maker() as session:
                    for row in reg_rows:
                        code = str(row.get("course_code") or "").strip()
                        if not code:
                            continue
                        c = await _ensure_course(
                            session, code, str(row.get("course_name") or ""), row.get("credits")
                        )
                        term = str(row.get("term_code") or "CURRENT")[:32]
                        await _upsert_enrollment(
                            session,
                            student_id=student_id,
                            course_id=c.id,
                            term_code=term,
                            status="in_progress",
                            final_grade_10=None,
                        )
                    await session.commit()
        except Exception as exc:
            logger.warning("ĐKHP sync failed (non-critical): %s", exc)

        await _emit(redis, job_id, "daa_schedule", 50, "Đang đồng bộ thời khóa biểu")
        sched_html = await daa_get_text(daa_client, settings.daa_schedule_path)
        sched_rows = parse_schedule_rows(sched_html)
        async with maker() as session:
            await session.execute(delete(Schedule).where(Schedule.student_id == student_id))
            await _persist_schedule(session, student_id, sched_rows)
            await session.commit()

        await _emit(redis, job_id, "daa_exams", 65, "Đang đồng bộ lịch thi")
        exams_html = await daa_get_text(daa_client, settings.daa_exams_path)
        exam_rows = parse_exam_rows(exams_html)
        async with maker() as session:
            await session.execute(delete(Exam).where(Exam.student_id == student_id))
            await _persist_exams(session, student_id, exam_rows)
            await session.commit()

        await _emit(redis, job_id, "moodle_authenticating", 72, "Đang đăng nhập Moodle")
        try:
            moodle_client = await moodle_login(
                settings, username=student_code, password=password_plain
            )
            cal_html = await moodle_get_text(moodle_client, settings.moodle_calendar_path)
            async with maker() as session:
                await _persist_moodle_deadlines(session, student_id, cal_html)
                await session.commit()
            summary["moodle"] = "ok"
        except Exception as exc:
            logger.warning("moodle sync partial failure: %s", exc)
            summary["moodle"] = f"partial:{type(exc).__name__}"

        await _emit(redis, job_id, "persisting", 92, "Đang hoàn tất")
        async with maker() as session:
            await record_audit(
                session,
                actor_type="student",
                actor_id=student_id,
                action="onboarding_completed",
                target_type="sync_job",
                target_id=str(job_id),
                payload={"summary": summary},
                ip_address=None,
            )
            await _update_job(
                session,
                job_id,
                stage="completed",
                pct=100,
                status="completed",
                summary=summary,
            )
        await _emit(redis, job_id, "completed", 100, "Đồng bộ hoàn tất")
    except Exception as exc:
        logger.exception("onboarding sync failed")
        async with maker() as session:
            await _update_job(
                session,
                job_id,
                stage="failed",
                pct=0,
                status="failed",
                err=str(exc),
                summary=summary,
            )
        await _emit(redis, job_id, "failed", 0, str(exc))
    finally:
        if moodle_client is not None:
            await moodle_client.aclose()
        await daa_client.aclose()

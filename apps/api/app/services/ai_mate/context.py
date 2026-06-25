from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.academic import Course, Enrollment, TermExamSchedule
from app.db.models.core_security import Student
from app.db.models.rag_chat import ChatSummary, PinnedMessage
from app.services.academic.gpa import EnrollmentRow, compute_cumulative_gpa, is_passed

_MAX_SUMMARIES = 5
_MAX_PINS = 10
_PIN_SNIPPET = 400


async def build_realtime_context_block(db: AsyncSession, student: Student) -> str:
    res = await db.execute(
        select(Student).options(selectinload(Student.major)).where(Student.id == student.id)
    )
    st = res.scalar_one()
    major_name = st.major.name if st.major else "Chưa rõ"

    res = await db.execute(
        select(Enrollment)
        .options(selectinload(Enrollment.course))
        .where(Enrollment.student_id == st.id)
    )
    enrollments = list(res.scalars().all())

    rows: list[EnrollmentRow] = []
    current_courses: list[str] = []
    failed_courses: list[str] = []
    for e in enrollments:
        rows.append(
            EnrollmentRow(
                credits=int(e.course.credits) if e.course else 0,
                final_grade_10=e.final_grade_10,
            )
        )
        label = f"{e.course.code} - {e.course.name} ({e.term_code})" if e.course else e.term_code
        if e.final_grade_10 is None:
            current_courses.append(label)
        elif not is_passed(e.final_grade_10):
            failed_courses.append(f"{label} điểm {e.final_grade_10}")

    gpa = compute_cumulative_gpa(rows)

    exam_lines: list[str] = []
    term_codes = {e.term_code for e in enrollments if e.term_code}
    course_ids = {e.course_id for e in enrollments}
    if term_codes and course_ids:
        today = date.today()
        er = await db.execute(
            select(TermExamSchedule, Course)
            .join(Course, Course.id == TermExamSchedule.course_id)
            .where(
                TermExamSchedule.term_code.in_(term_codes),
                TermExamSchedule.course_id.in_(course_ids),
                TermExamSchedule.exam_date >= today,
            )
            .order_by(TermExamSchedule.exam_date.asc(), TermExamSchedule.start_time.asc())
            .limit(8)
        )
        for exam, course in er.all():
            exam_lines.append(
                f"{course.code} — {exam.exam_date} {exam.start_time}-{exam.end_time}"
                + (f" phòng {exam.room}" if exam.room else "")
            )

    transcript_lines: list[str] = []
    for e in enrollments:
        if e.course:
            grade_str = str(e.final_grade_10) if e.final_grade_10 is not None else "(chưa có điểm)"
            transcript_lines.append(
                f"- {e.course.code} - {e.course.name} ({e.term_code}): {grade_str}"
            )

    lines = [
        f"Ngành: {major_name}",
        f"Năm nhập học (hồ sơ): {st.enrollment_year}",
        f"GPA (thang 10): {gpa.gpa_10} | "
        f"Tín chỉ tích lũy (có điểm): {gpa.total_credits} | Tín chỉ đạt: {gpa.earned_credits}",
        f"Môn đang học/chưa có điểm cuối kỳ: {', '.join(current_courses) if current_courses else '(không có trong DB)'}",
        f"Môn chưa đạt (đã có điểm): {', '.join(failed_courses) if failed_courses else '(không)'}",
        "Lịch thi sắp tới: " + ("; ".join(exam_lines) if exam_lines else "(không)"),
        "BẢNG ĐIỂM CHI TIẾT:",
        "\n".join(transcript_lines) if transcript_lines else "(Chưa có dữ liệu bảng điểm)",
    ]
    return "\n".join(lines)


async def build_historical_context_block(
    db: AsyncSession,
    student_id: UUID,
) -> str:
    now = datetime.now(UTC)
    sres = await db.execute(
        select(ChatSummary)
        .where(ChatSummary.student_id == student_id, ChatSummary.expires_at > now)
        .order_by(ChatSummary.created_at.desc())
        .limit(_MAX_SUMMARIES)
    )
    summaries = list(sres.scalars().all())
    pres = await db.execute(
        select(PinnedMessage)
        .where(PinnedMessage.student_id == student_id)
        .order_by(PinnedMessage.created_at.desc())
        .limit(_MAX_PINS)
    )
    pins = list(pres.scalars().all())

    parts: list[str] = []
    if summaries:
        parts.append("Tóm tắt phiên trước (đã cấu trúc):")
        for s in summaries:
            coi = ", ".join(s.courses_of_interest or [])
            rq = ", ".join(s.recent_questions or [])
            parts.append(
                f"- Khóa học quan tâm: {coi or '(trống)'} | Chủ đề gần đây: {rq or '(trống)'}"
            )
    else:
        parts.append("Chưa có tóm tắt phiên trước trên server.")

    if pins:
        parts.append("Tin nhắn ghim (server, do người dùng chọn lưu):")
        for p in pins:
            snippet = (p.content or "")[:_PIN_SNIPPET]
            parts.append(f"- {snippet}")
    else:
        parts.append("Chưa có tin ghim.")

    return "\n".join(parts)


def detect_policy_intent(message: str) -> bool:
    m = message.lower()
    keys = (
        "quy chế",
        "quy che",
        "đào tạo",
        "dao tao",
        "học vụ",
        "hoc vu",
        "điểm",
        "diem",
        "thi",
        "thi hành",
        "nợ môn",
        "no mon",
        "cảnh báo",
        "canh bao",
        "tốt nghiệp",
        "tot nghiep",
    )
    return any(k in m for k in keys)
